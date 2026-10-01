"""Catalogue expansion research: which 🎯 topics and 🍃 genres to add next (docs/expansion-candidates.md).

Two questions, answered with API data:
  1. demand — what do readers in their 20s (and 30s, for comparison) actually borrow?
     정보나루 loanItemSrch, last 12 months, top 5,000 books per age band, aggregated by KDC division
     and by title rules for each candidate. Plus 12 months of monthlyKeywords (all ages).
  2. supply — how many eligible YES24 books exist per candidate and per draft keyword?
     YES24 category bestseller / steady lists + keyword searches, filtered like src/collect_candidates.py
     (general books, introduction >= 100 chars, not study guides / sets / children), then scaled by the
     detail pass rate (TOC + rating + pages present) observed in D1.

Usage:  python src/research_expansion.py
Input:  .env (DATA4LIBRARY_KEY, YES24_API_KEY), web/src/data/books.json (current 200-book pool),
        data/processed/d1_candidates.json (D1 detail pass rate)
Output: data/raw/expansion/d4l/*.json, data/raw/expansion/yes24/*.json   (raw responses, cached, git-ignored)
        data/processed/expansion_research.json                           (counts, titles, ISBNs only)
        summary printed to stdout
The API keys are read from .env and never printed. No YES24 introduction / TOC text is written to processed output.
"""
import json
import re
import time
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

from collect_candidates import FAILURES, cached_get, intro_of, is_book, norm_title
from compare_apis import d4l, load_env

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "expansion"
OLD_LISTS = ROOT / "data" / "raw" / "yes24" / "lists"
POOL = ROOT / "web" / "src" / "data" / "books.json"
D1 = ROOT / "data" / "processed" / "d1_candidates.json"
OUT = ROOT / "data" / "processed" / "expansion_research.json"

PERIOD = ("2025-10-01", "2026-09-30")
AGES = {"20s": "20", "30s": "30"}
LOAN_PAGES, LOAN_PAGE_SIZE = 5, 1000            # top 5,000 books (the API caps numFound at 5,000)
MONTHS = [f"2025-{m:02d}" for m in (10, 11, 12)] + [f"2026-{m:02d}" for m in range(1, 10)]
MIN_INTRO = 100
EXAM = re.compile(r"토익|TOEIC|토플|기출|해커스|에듀윌|공무원|자격증|모의고사|문제집|수험|한국사능력|NCS|컴활|"
                  r"기사\s?(?:필기|실기)|합격|적성검사|인적성|시험")

# KDC division (class_no[:2]) -> where it sits in Galpi today. Transparent, hand-made mapping.
KDC_NOW = {
    "81": "🍃 한국 소설·시·에세이", "82": "🍃 외국 소설", "83": "🍃 외국 소설", "84": "🍃 외국 소설",
    "85": "🍃 외국 소설", "86": "🍃 외국 소설", "87": "🍃 외국 소설", "88": "🍃 외국 소설", "89": "🍃 외국 소설",
    "80": "없음 (문학 일반·작법)",
    "10": "🍃 인문 (일부)", "11": "🍃 인문 (일부)", "12": "🍃 인문 (일부)", "13": "🍃 인문 (일부)",
    "14": "🍃 인문 (일부)", "15": "🍃 인문 (일부)", "16": "🍃 인문 (일부)", "17": "🍃 인문 (일부)",
    "18": "🍃 인문 (심리, 일부) · 🎯 습관·집중 (일부)", "19": "🍃 인문 (일부)",
    "40": "🍃 과학 교양", "41": "🍃 과학 교양", "42": "🍃 과학 교양", "43": "🍃 과학 교양", "44": "🍃 과학 교양",
    "45": "🍃 과학 교양", "46": "🍃 과학 교양", "47": "🍃 과학 교양", "48": "🍃 과학 교양", "49": "🍃 과학 교양",
    "60": "🍃 예술·여행", "61": "🍃 예술·여행", "62": "🍃 예술·여행", "63": "🍃 예술·여행", "64": "🍃 예술·여행",
    "65": "🍃 예술·여행", "66": "🍃 예술·여행", "67": "🍃 예술·여행", "68": "🍃 예술·여행", "69": "🍃 예술·여행",
    "98": "🍃 예술·여행", "00": "🎯 데이터·AI (일부)", "31": "🎯 통계 (일부)",
}

# current 🎯 topics as one loose title rule (for "how much of 20s demand do we already cover")
CURRENT_TARGET = re.compile(r"데이터|SQL|통계|확률|(?<![A-Za-z])AI(?![A-Za-z])|인공지능|챗GPT|GPT|프롬프트|자동화|"
                            r"엑셀|노션|습관|집중|몰입|도파민|루틴|시간 ?관리|생산성|일 ?잘|메모|세컨드 ?브레인")

# 🎯 candidates. title: title rule for loans and YES24 eligibility; kw: draft keywords (regex on title + intro);
# q: YES24 searches; cats: YES24 categories; overlap: existing topics that could claim the same books.
EXC_STUDY = r"수험|기출|자격|공무원|NCS|교재|문제집|워크북"
TOPICS: dict[str, dict] = {
    "돈 관리·투자": {
        "title": r"재테크|투자|주식|ETF|펀드|저축|가계부|월급|부자|(?<![가-힣])돈|자산|연금|부동산|청약|금리|배당",
        "exc": EXC_STUDY + r"|투자론|회계원리|코인 ?자동매매",
        "kw": {"재테크 기초": r"재테크|저축|가계부|월급|사회 ?초년생|통장",
               "주식·ETF": r"주식|ETF|펀드|배당|지수",
               "부동산·청약": r"부동산|청약|내 ?집|아파트",
               "연금·노후": r"연금|노후|은퇴|파이어족|FIRE",
               "돈의 심리": r"돈의 ?심리|부의 ?(?:마인드|본능|감각)|부자 ?(?:마인드|습관|의 ?사고)|돈 ?(?:그릇|공부)",
               "경제 기초": r"금리|환율|인플레이션|경제 ?(?:기초|상식|공부|흐름)"},
        "q": ["재테크 입문", "주식 투자 입문", "ETF 투자", "부동산 공부", "사회초년생 돈 관리", "돈의 심리"],
        "cats": ["001001025010"], "overlap": []},
    "경제 상식": {
        "title": r"경제|금리|환율|인플레이션|경기|자본주의|화폐|무역|트렌드",
        "exc": EXC_STUDY + r"|경제학원론|미시경제학|거시경제학|계량경제",
        "kw": {"금리·환율": r"금리|환율|인플레이션|물가|연준",
               "경제 뉴스 읽기": r"경제 ?(?:뉴스|기사|신문)|경제 ?(?:상식|교양|공부)",
               "행동경제학": r"행동 ?경제|넛지|심리학과 ?경제",
               "경제사·자본주의": r"경제사|자본주의|화폐|부의 ?역사",
               "트렌드": r"트렌드|미래 ?전망|소비 ?(?:트렌드|문화)"},
        "q": ["경제 상식", "경제 공부 입문", "행동경제학", "금리 환율", "트렌드 코리아"],
        "cats": ["001001025007", "001001025013"], "overlap": ["돈 관리·투자"]},
    "취업·커리어": {
        "title": r"취업|이직|커리어|면접|자기소개서|자소서|직장|퇴사|직업|사회 ?초년생|신입|퍼스널 ?브랜딩|일의 ?(?:의미|기쁨)|진로",
        "exc": EXC_STUDY + r"|인적성|적성검사|대기업 ?(?:필기|인적성)|공기업",
        "kw": {"자소서·면접": r"자기소개서|자소서|면접",
               "이직·퇴사": r"이직|퇴사|전직",
               "커리어 설계": r"커리어|경력|진로|직업",
               "퍼스널 브랜딩": r"퍼스널 ?브랜딩|나를 ?브랜딩|브랜드가 ?되",
               "직장 생활": r"직장 ?(?:생활|인)|회사 ?생활|사회 ?초년생|신입|팀장|리더십"},
        "q": ["취업 준비", "커리어", "이직", "퍼스널 브랜딩", "직장생활", "면접 잘 보는 법"],
        "cats": ["001001026002", "001001026005", "001001025014"], "overlap": ["시간·생산성"]},
    "글쓰기": {
        "title": r"글쓰기|글 ?잘|문장|작문|쓰는 ?(?:법|기술)|글을 ?쓰|카피라이팅|문해력|어휘력|보고서|기획서|에세이 ?쓰기|책 ?쓰기",
        "exc": EXC_STUDY + r"|논술|수능|필사|일본어|영어",
        "kw": {"글쓰기 기초": r"글쓰기|문장|좋은 ?글",
               "에세이·책 쓰기": r"에세이 ?쓰기|책 ?쓰기|출간|작가 ?(?:되|데뷔)|투고",
               "업무 글": r"보고서|기획서|이메일|비즈니스 ?(?:글|라이팅)|업무 ?글",
               "카피라이팅": r"카피|광고 ?(?:문구|글)",
               "문해력·어휘": r"문해력|어휘|맞춤법|국어",
               "일기·편지": r"일기|편지"},
        "q": ["글쓰기", "글쓰기 책", "에세이 쓰기", "보고서 쓰기", "카피라이팅", "문해력"],
        "cats": ["001001019016"], "overlap": []},
    "말하기·대화": {
        "title": r"말하기|말 ?잘|말투|대화법|화법|스피치|발표|프레젠테이션|설득|협상|말의 ?(?:힘|품격|기술)|말 ?그릇",
        "exc": EXC_STUDY + r"|영어 ?(?:말하기|회화)|회화|토론 ?대회",
        "kw": {"발표·프레젠테이션": r"발표|프레젠테이션|PT|스피치",
               "대화법·말투": r"대화|말투|화법|말 ?(?:습관|그릇)",
               "설득·협상": r"설득|협상|영향력",
               "질문·경청": r"질문|경청|듣기",
               "목소리": r"목소리|보이스|발성"},
        "q": ["말하기", "말투", "대화법", "발표 잘하는 법", "설득의 기술", "협상"],
        "cats": ["001001026004"], "overlap": ["인간관계"]},
    "인간관계": {
        "title": r"인간관계|관계 ?(?:심리|수업|의 ?기술)|사람 ?(?:사이|관계)|거리 ?두기|손절|공감|사회생활|다정|무례|호감",
        "exc": EXC_STUDY + r"|국제관계|외교",
        "kw": {"거리·경계": r"거리|경계|손절|선을",
               "공감·감정": r"공감|감정",
               "갈등·무례 대처": r"갈등|무례|싸움|화내",
               "사회생활": r"사회생활|직장|동료",
               "가족·친구": r"가족|부모|친구"},
        "q": ["인간관계", "관계 심리", "거리 두기", "사회생활", "무례한 사람"],
        "cats": ["001001026009"], "overlap": ["말하기·대화", "마음 돌보기"]},
    "대화·관계": {  # 말하기·대화 + 인간관계 merged (each alone is small in 20s loans)
        "title": r"말하기|말 ?잘|말투|대화법|화법|스피치|발표|프레젠테이션|설득|협상|말의 ?(?:힘|품격|기술)|말 ?그릇|"
                 r"인간관계|관계 ?(?:심리|수업|의 ?기술)|사람 ?(?:사이|관계)|거리 ?두기|손절|공감|사회생활|다정|무례|호감",
        "exc": EXC_STUDY + r"|영어 ?(?:말하기|회화)|회화|토론 ?대회|국제관계|외교",
        "kw": {"말투·대화법": r"대화|말투|화법|말 ?(?:습관|그릇)",
               "발표·프레젠테이션": r"발표|프레젠테이션|PT|스피치",
               "설득·협상": r"설득|협상|영향력",
               "거리·경계": r"거리 ?두기|경계|손절|선을",
               "갈등·무례 대처": r"갈등|무례|싸움|화내",
               "호감·사회생활": r"호감|사회생활|직장 ?(?:관계|동료)"},
        "q": ["말하기", "말투", "대화법", "발표 잘하는 법", "설득의 기술", "협상", "인간관계", "관계 심리",
              "거리 두기", "사회생활", "무례한 사람"],
        "cats": ["001001026004", "001001026009"], "overlap": ["마음 돌보기"]},
    "마음 돌보기": {
        "title": r"불안|자존감|우울|감정|마음 ?(?:챙김|공부|돌봄|치유|의 ?상처)|번아웃|상처|트라우마|스트레스|멘탈|회복 ?탄력|공황|외로움",
        "exc": EXC_STUDY + r"|상담 ?이론|임상",
        "kw": {"불안·걱정": r"불안|걱정|공황",
               "자존감": r"자존감|자기 ?(?:긍정|수용|비하)",
               "감정 다루기": r"감정",
               "번아웃·스트레스": r"번아웃|스트레스|지친|소진",
               "우울": r"우울",
               "명상·마음챙김": r"명상|마음 ?챙김|마인드풀"},
        "q": ["불안", "자존감", "감정 조절", "번아웃", "마음챙김 명상", "우울"],
        "cats": ["001001019004", "001001047003"], "overlap": ["습관·집중"]},
    "마케팅·브랜딩": {
        "title": r"마케팅|브랜딩|브랜드|광고|카피|콘텐츠|SNS|인스타그램|유튜브|소비자|세일즈|팔리는|컨셉",
        "exc": EXC_STUDY + r"|원론|마케팅 ?관리론",
        "kw": {"브랜딩": r"브랜딩|브랜드",
               "콘텐츠·SNS": r"콘텐츠|SNS|인스타|유튜브|블로그|숏폼",
               "카피라이팅": r"카피|문구",
               "소비자 심리": r"소비자|고객 ?(?:심리|경험)|구매 ?심리",
               "그로스·데이터 마케팅": r"그로스|퍼포먼스|데이터 ?마케팅|GA4|전환율"},
        "q": ["마케팅 입문", "브랜딩", "콘텐츠 마케팅", "카피라이팅", "소비자 심리", "그로스 마케팅"],
        "cats": ["001001025009"], "overlap": ["글쓰기"]},
    "창업·부업": {
        "title": r"창업|부업|사이드 ?프로젝트|N잡|스마트스토어|1인 ?(?:기업|사업)|스타트업|프리랜서|온라인 ?(?:판매|사업)",
        "exc": EXC_STUDY,
        "kw": {"창업": r"창업|사업 ?계획",
               "부업·N잡": r"부업|N잡|부수입|사이드 ?프로젝트",
               "온라인 판매": r"스마트스토어|쿠팡|온라인 ?(?:판매|쇼핑몰)|이커머스",
               "스타트업": r"스타트업|투자 ?유치|린",
               "프리랜서·1인": r"프리랜서|1인|퇴사 ?후"},
        "q": ["창업 입문", "부업", "스마트스토어", "스타트업", "프리랜서", "사이드 프로젝트"],
        "cats": ["001001025014", "001001003026"], "overlap": ["취업·커리어", "마케팅·브랜딩"]},
    "공부법·독서법": {
        "title": r"공부법|공부하는 ?법|공부의 ?(?:기술|본질|힘)|독서법|책 ?읽기|읽는 ?사람|메타인지|기억법|기억력|암기법|학습법|어른의 ?공부",
        "exc": EXC_STUDY + r"|수능|내신|초등|중학|고등|자녀",
        "kw": {"공부법": r"공부법|공부하는 ?법|학습법",
               "독서법": r"독서|책 ?읽기|읽는 ?법",
               "메타인지": r"메타인지",
               "기억·암기": r"기억|암기",
               "노트·정리": r"노트|정리|필기"},
        "q": ["공부법", "독서법", "메타인지", "기억력", "어른의 공부"],
        "cats": ["001001019017"], "overlap": ["습관·집중", "시간·생산성"]},
    "코딩 입문": {
        "title": r"코딩|프로그래밍|개발자|자바스크립트|웹 ?개발|알고리즘|(?<![A-Za-z])Git|파이썬 ?(?:입문|기초|프로그래밍)|비전공자",
        "exc": EXC_STUDY + r"|정보처리|코딩 ?테스트 ?기출",
        "kw": {"파이썬 기초": r"파이썬|Python",
               "웹 개발": r"웹|HTML|자바스크립트|JavaScript|리액트|React",
               "알고리즘": r"알고리즘|자료 ?구조|코딩 ?테스트",
               "개발자 커리어": r"개발자",
               "비전공자 입문": r"비전공|입문|처음"},
        "q": ["코딩 입문", "비전공자 개발", "프로그래밍 입문", "웹 개발 입문", "알고리즘 입문"],
        "cats": ["001001003022"], "overlap": ["데이터 분석", "업무 자동화", "AI 활용"]},
    "건강·운동": {
        "title": r"운동|헬스|근력 ?운동|근육|다이어트|식단|수면|건강|요가|러닝|달리기|스트레칭|바른 ?자세|노화|혈당",
        "exc": EXC_STUDY + r"|간호|의학 ?(?:개론|용어)|해부학 ?(?:교과|아틀라스)|생활스포츠지도사|마음 ?근력|회복 ?탄력|ETF|사회",
        "kw": {"운동·근력": r"운동|근력|근육|헬스|홈트",
               "식단·영양": r"식단|영양|다이어트|단백질|혈당",
               "수면": r"수면|잠",
               "러닝·걷기": r"러닝|달리기|마라톤|걷기",
               "몸·통증": r"통증|자세|스트레칭|척추|거북목"},
        "q": ["운동 입문", "근력 운동", "식단 관리", "수면", "러닝", "스트레칭"],
        "cats": ["001001011002", "001001011008"], "overlap": ["습관·집중"]},
    "영어 공부": {
        "title": r"영어",
        "exc": EXC_STUDY + r"|토익|TOEIC|토플|수능|초등|중학|고등|단어장|문법 ?(?:문제|교재)|사전",
        "kw": {"영어 공부법": r"공부법|영어 ?공부",
               "회화": r"회화|말하기|스피킹",
               "단어·표현": r"단어|표현|어휘",
               "원서 읽기": r"원서|리딩|읽기",
               "문법": r"문법"},
        "q": ["영어 공부법", "영어 회화 독학", "영어 원서 읽기", "어른 영어"],
        "cats": [], "overlap": []},
}

# current 🎯 topic title rules (from src/collect_candidates.py SLOTS) for overlap measurement
EXISTING_TOPICS = {
    "데이터 분석": r"데이터|SQL|시각화|대시보드",
    "통계": r"통계|확률|베이즈",
    "AI 활용": r"(?<![A-Za-z])AI(?![A-Za-z])|인공지능|챗GPT|GPT|프롬프트|생성형|제미나이|클로드|LLM|바이브 ?코딩",
    "업무 자동화": r"자동화|엑셀|노션|스프레드시트|코파일럿|RPA",
    "습관·집중": r"습관|집중|몰입|루틴|도파민|뇌|의지|자제력",
    "시간·생산성": r"시간 ?관리|생산성|메모|기록|일하는|일 ?잘|효율|계획|브레인",
}

# 🍃 candidates. kdc: class_no prefixes for 20s loan share; cats: YES24 categories; sort: goodsSortNm rule.
GENRES: dict[str, dict] = {
    "역사": {"kdc": ("90", "91", "92", "93", "94", "95", "96", "97"), "sort": r"역사|인문",
           "cats": ["001001010002", "001001010012", "001001010008", "001001010005"],
           "exc": r"한국사능력|검정|수험|기출|연표|교과서|초등|중학|고등|수능", "boundary": "인문",
           "axes": "알게 됨 · 현실 · 몰입(서사형 역사)"},
    "심리": {"kdc": ("18",), "sort": r"인문", "cats": ["001001019004"],
           "exc": r"상담 ?이론|임상|수험|기출|자격", "boundary": "인문(지금 인문 후보 카테고리에 심리가 포함) · 🎯 마음 돌보기 후보",
           "axes": "알게 됨 · 마음 · 현실"},
    "사회·시사": {"kdc": ("33", "34", "30"), "sort": r"사회|정치",
               "cats": ["001001022005", "001001022008", "001001022007", "001001022013", "001001022003"],
               "exc": r"수험|기출|공무원|행정학|교과", "boundary": "인문 · 경제 교양",
               "axes": "알게 됨 · 현실 · 여운(문제 제기형)"},
    "경제 교양": {"kdc": ("320", "321", "322"), "sort": r"경제", "cats": ["001001025007", "001001025013"],
               "exc": r"수험|기출|원론|미시경제학|거시경제학|재테크|주식|부동산|ETF",
               "boundary": "🎯 돈 관리·투자 / 경제 상식 후보", "axes": "알게 됨 · 현실"},
    "철학": {"kdc": ("10", "11", "12", "13", "14", "15", "16", "17", "19"), "sort": r"인문",
           "cats": ["001001019003", "001001019015", "001001019014"],
           "exc": r"수험|기출|명리|주역|사주", "boundary": "인문(지금 인문 10권 중 다수가 철학·인생론)",
           "axes": "알게 됨/마음 · 문장 · 현실"},
    "고전 문학": {"kdc": (), "sort": r"소설|시|희곡", "cats": ["001001046013"],
               "exc": r"수능|교과서|논술|초등|청소년|만화", "boundary": "외국 소설 · 한국 소설",
               "axes": "여운 · 문장 · 현실"},
    "호러·괴담": {"kdc": (), "sort": r"소설", "cats": ["001001046011"],
               "inc": r"공포|호러|괴담|괴이|기담|귀신|좀비|저주|오컬트|괴물|유령|악령",
               "exc": r"추리 ?소설 ?(?:작법|쓰기)", "boundary": "추리·스릴러 · SF·판타지",
               "q": ["공포 소설", "호러 소설", "괴담", "K-호러", "오컬트 소설"],
               "axes": "여운(서늘함) · 몰입 · 딴 세상"},
    "신화·전설": {"kdc": ("21",), "sort": r"인문|종교|소설", "cats": ["001001019006"],
               "inc": r"신화|전설|민담|설화|요괴|신들",
               "exc": r"수험|기출|성경 ?(?:공부|통독)", "boundary": "인문 · SF·판타지",
               "q": ["그리스 로마 신화", "북유럽 신화", "한국 신화", "신화 이야기"],
               "axes": "알게 됨 · 딴 세상 · 몰입"},
    "판타지 (분리)": {"kdc": (), "sort": r"소설", "cats": ["001001046011", "001001046001", "001001046002"],
                 "inc": r"판타지|마법|마녀|요정|드래곤|이세계|환상|요괴|정령|신화",
                 "exc": r"SF|우주|로봇|외계|추리|살인|탐정|작법", "boundary": "SF·판타지를 둘로 나눔",
                 "q": ["판타지 소설", "한국 판타지 소설", "환상 소설", "마법 소설"],
                 "axes": "딴 세상 · 몰입 · 따뜻함/여운"},
    "인물·전기": {"kdc": ("99",), "sort": r"인물|에세이|인문|역사", "cats": ["001001020009", "001001020004",
                                                                      "001001020007", "001001020001"],
               "exc": r"수험|위인전|초등|어린이", "boundary": "에세이 · 역사",
               "axes": "현실 · 몰입 · 마음/알게 됨"},
}


# ---------- 정보나루 ----------

def d4l_cached(env: dict, name: str, endpoint: str, **params) -> dict:
    cache = RAW / "d4l" / f"{name}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    resp = d4l(env, endpoint, **params)
    time.sleep(0.3)
    if "error" in resp or "response" not in resp:
        FAILURES.append(f"d4l {endpoint} {name} -> {str(resp)[:120]}")
        return resp
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(resp, ensure_ascii=False), encoding="utf-8")
    return resp


def top_loans(env: dict, age: str) -> list[dict]:
    docs = []
    for page in range(1, LOAN_PAGES + 1):
        resp = d4l_cached(env, f"loans_age{age}_p{page}", "loanItemSrch", startDt=PERIOD[0], endDt=PERIOD[1],
                          age=age, pageNo=page, pageSize=LOAN_PAGE_SIZE)
        docs += [d["doc"] for d in (resp.get("response") or {}).get("docs", [])]
    for d in docs:
        d["loans"] = int(d.get("loan_count") or 0)
        d["exam"] = bool(EXAM.search(d.get("bookname") or ""))
    return docs


def kdc_name(doc: dict, level: int) -> str:
    parts = [p.strip() for p in (doc.get("class_nm") or "").split(">")]
    return " > ".join(parts[:level]) if parts and parts[0] else "분류 없음"


def kdc_shares(docs: list[dict]) -> list[dict]:
    """Loan share by KDC division (class_no[:2]), exam books excluded."""
    books = [d for d in docs if not d["exam"]]
    total = sum(d["loans"] for d in books) or 1
    agg: dict[str, dict] = {}
    for d in books:
        div = (d.get("class_no") or "??")[:2]
        row = agg.setdefault(div, {"div": div, "name": kdc_name(d, 2), "loans": 0, "books": 0})
        row["loans"] += d["loans"]
        row["books"] += 1
    rows = sorted(agg.values(), key=lambda r: -r["loans"])
    for r in rows:
        r["share"] = round(r["loans"] / total, 4)
        r["galpi_now"] = KDC_NOW.get(r["div"], "없음")
    return rows


def is_literature(doc: dict) -> bool:
    """KDC 81x-89x (novels, poems, essays). 80x (literature in general, writing) is kept as non-fiction."""
    return bool(re.match(r"8[1-9]", doc.get("class_no") or ""))


def title_demand(docs: list[dict], rule: str, exc: str = "") -> dict:
    """Loans of non-literature books whose title matches a 🎯 rule (novel titles like '마음' are not topics)."""
    books = [d for d in docs if not d["exam"]]
    total = sum(d["loans"] for d in books) or 1
    nonfic = sum(d["loans"] for d in books if not is_literature(d)) or 1
    hit = [d for d in books if not is_literature(d) and re.search(rule, d.get("bookname") or "")
           and not (exc and re.search(exc, d.get("bookname") or ""))]
    hit.sort(key=lambda d: -d["loans"])
    loans = sum(d["loans"] for d in hit)
    return {"books": len(hit), "loans": loans, "share": round(loans / total, 4),
            "nonfiction_share": round(loans / nonfic, 4),
            "top": [f"{d['bookname'].split(':')[0].strip()} ({d['loans']})" for d in hit[:6]]}


def kdc_detail(docs: list[dict], divisions: tuple) -> dict:
    """Loan share by 3-digit KDC section inside the given divisions (e.g. 32 economics = 320~329)."""
    books = [d for d in docs if not d["exam"]]
    total = sum(d["loans"] for d in books) or 1
    agg: dict[str, dict] = {}
    for d in books:
        sec = (d.get("class_no") or "")[:3]
        if sec[:2] in divisions:
            row = agg.setdefault(sec, {"name": kdc_name(d, 3), "loans": 0, "books": 0, "top": []})
            row["loans"] += d["loans"]
            row["books"] += 1
            if len(row["top"]) < 3:
                row["top"].append(d["bookname"].split(":")[0].strip())
    return {s: dict(r, share=round(r["loans"] / total, 4))
            for s, r in sorted(agg.items(), key=lambda kv: -kv[1]["loans"])}


def kdc_demand(docs: list[dict], prefixes: tuple) -> dict:
    books = [d for d in docs if not d["exam"]]
    total = sum(d["loans"] for d in books) or 1
    hit = [d for d in books if prefixes and (d.get("class_no") or "").startswith(prefixes)]
    hit.sort(key=lambda d: -d["loans"])
    return {"books": len(hit), "share": round(sum(d["loans"] for d in hit) / total, 4),
            "top": [f"{d['bookname'].split(':')[0].strip()} ({d['loans']})" for d in hit[:5]]}


def isbn_demand(docs: list[dict], isbns: set[str]) -> dict:
    books = [d for d in docs if not d["exam"]]
    total = sum(d["loans"] for d in books) or 1
    hit = [d for d in books if d.get("isbn13") in isbns]
    hit.sort(key=lambda d: -d["loans"])
    return {"books": len(hit), "share": round(sum(d["loans"] for d in hit) / total, 4),
            "top": [f"{d['bookname'].split(':')[0].strip()} ({d['loans']})" for d in hit[:6]]}


def monthly_keywords(env: dict) -> list[list]:
    words: Counter = Counter()
    months: Counter = Counter()
    for m in MONTHS:
        resp = d4l_cached(env, f"monthlyKeywords_{m}", "monthlyKeywords", month=m)
        for k in (resp.get("response") or {}).get("keywords", []):
            w = k["keyword"]["word"]
            words[w] += float(k["keyword"]["weight"])
            months[w] += 1
    return [[w, months[w], round(s, 1)] for w, s in words.most_common(60)]


# ---------- YES24 ----------

def yes24(env: dict, path: str, name: str) -> dict:
    old = OLD_LISTS / f"{name}.json"
    if old.exists():
        return json.loads(old.read_text(encoding="utf-8"))
    return cached_get(env, path, RAW / "yes24" / f"{name}.json")


def category_items(env: dict, cats: list[str]) -> list[dict]:
    items = []
    for cat in cats:
        for ep in ("bestsellerSteady", "bestseller"):
            for page in (1, 2):
                resp = yes24(env, f"/category/{ep}?categoryId={cat}&page={page}&pageSize=100", f"{cat}_{ep}_{page}")
                items += (resp.get("data") or {}).get("items") or []
    return items


def search_items(env: dict, queries: list[str]) -> tuple[list[dict], dict]:
    items, totals = [], {}
    for q in queries:
        slug = re.sub(r"[^0-9A-Za-z가-힣]+", "_", q).strip("_")
        resp = yes24(env, "/goods/itemList?" + urllib.parse.urlencode({"query": q, "page": 1, "pageSize": 100}),
                     f"search_{slug}")
        data = resp.get("data") or {}
        totals[q] = data.get("totalCount")
        items += data.get("items") or []
    return items, totals


def eligible(items: list[dict], pool: set[str], sort: str, inc: str, exc: str, title_only: bool) -> list[dict]:
    seen_isbn, seen_title, out = set(), set(), []
    for it in items:
        isbn, title = it.get("isbn13"), it.get("title") or ""
        if not isbn or isbn in seen_isbn or isbn in pool or not is_book(it) or len(intro_of(it)) < MIN_INTRO:
            continue
        if sort and not re.search(sort, it.get("goodsSortNm") or ""):
            continue
        text = title if title_only else f"{title} {intro_of(it)[:300]}"
        if (inc and not re.search(inc, text)) or (exc and re.search(exc, title)):
            continue
        t = norm_title(title)
        if t in seen_title:
            continue
        seen_isbn.add(isbn)
        seen_title.add(t)
        out.append(it)
    return out


def pass_rates() -> dict:
    rows = json.loads(D1.read_text(encoding="utf-8"))
    out = {}
    for entry in ("leaf", "target"):
        ok = sum(1 for r in rows if r["entry"] == entry and r["status"] in ("picked", "reserve"))
        bad = sum(1 for r in rows if r["entry"] == entry and r["status"] == "incomplete")
        out[entry] = round(ok / (ok + bad), 3) if ok + bad else 1.0
    return out


def topic_supply(env: dict, name: str, t: dict, pool: set[str], rate: float) -> dict:
    items = category_items(env, t["cats"])
    found, totals = search_items(env, t["q"])
    books = eligible(items + found, pool, r"", t["title"], t["exc"], title_only=True)
    n = len(books)
    kws = {}
    for kw, rule in t["kw"].items():
        k = sum(1 for b in books if re.search(rule, f"{b.get('title')} {intro_of(b)}"))
        k_title = sum(1 for b in books if re.search(rule, b.get("title") or ""))
        kws[kw] = {"books": k, "title_only": k_title, "share": round(k / n, 2) if n else 0}
    overlap = Counter(other for b in books for other, rule in EXISTING_TOPICS.items()
                      if re.search(rule, b.get("title") or ""))
    return {"eligible": n, "expected_usable": int(n * rate), "search_totals": totals, "keywords": kws,
            "overlap_existing": {k: v for k, v in overlap.most_common()},
            "overlap_share": round(sum(1 for b in books if any(re.search(r, b.get("title") or "")
                                                                for r in EXISTING_TOPICS.values())) / n, 2) if n else 0,
            "sample": [f"{b.get('title')} | {b.get('isbn13')}" for b in books[:8]]}


def genre_supply(env: dict, g: dict, pool: set[str], rate: float,
                 pool_genre: dict[str, str]) -> tuple[dict, set[str]]:
    items = category_items(env, g["cats"]) + search_items(env, g.get("q", []))[0]
    books = eligible(items, pool, g["sort"], g.get("inc", ""), g["exc"], title_only=False)
    recent = sum(1 for b in books if (b.get("publishDate") or "0")[:4] >= "2016")
    same_rule = eligible(items, set(), g["sort"], g.get("inc", ""), g["exc"], title_only=False)
    in_pool = Counter(pool_genre[it["isbn13"]] for it in same_rule if it.get("isbn13") in pool_genre)
    return ({"eligible": len(books), "expected_usable": int(len(books) * rate), "within_10y": recent,
             "current_pool_books_in_these_lists": dict(in_pool.most_common()),
             "sample": [f"{b.get('title')} | {b.get('isbn13')}" for b in books[:8]]},
            {b.get("isbn13") for b in books})


def axis_balance(pool_books: list[dict]) -> dict:
    """Share of 🍃 books on each side of each balance-game axis (balance-game.md 4절: each side >= 25%)."""
    leaf = [b for b in pool_books if b["entry"] == "leaf"]
    out = {}
    for ax in ("temp", "pull", "gain", "world"):
        c = Counter(b["axes"][ax] for b in leaf)
        out[ax] = {"+1": c[1], "0": c[0], "-1": c[-1], "n": len(leaf)}
    return out


# ---------- main ----------

def main() -> None:
    env = load_env()
    pool_books = json.loads(POOL.read_text(encoding="utf-8"))
    pool = {b["isbn"] for b in pool_books}
    pool_genre = {b["isbn"]: b["genre"] or b["topic"] for b in pool_books}
    rates = pass_rates()

    loans = {band: top_loans(env, age) for band, age in AGES.items()}
    result: dict = {"period": PERIOD, "pass_rates": rates, "loans": {}, "topics": {}, "genres": {},
                    "current_target_demand": {}, "monthly_keywords": monthly_keywords(env)}
    for band, docs in loans.items():
        exam = [d for d in docs if d["exam"]]
        result["loans"][band] = {
            "books": len(docs), "loans": sum(d["loans"] for d in docs),
            "exam_share": round(sum(d["loans"] for d in exam) / (sum(d["loans"] for d in docs) or 1), 4),
            "min_loans": min((d["loans"] for d in docs), default=0),
            "nonfiction_share": round(sum(d["loans"] for d in docs if not d["exam"] and not is_literature(d))
                                      / (sum(d["loans"] for d in docs if not d["exam"]) or 1), 4),
            "kdc": kdc_shares(docs)[:40],
            "kdc_detail": kdc_detail(docs, ("32", "18", "33", "19", "15", "16", "51", "59", "00", "80", "71", "37"))}
        result["current_target_demand"][band] = title_demand(docs, CURRENT_TARGET.pattern)

    for name, t in TOPICS.items():
        demand = {band: title_demand(docs, t["title"], t["exc"]) for band, docs in loans.items()}
        supply = topic_supply(env, name, t, pool, rates["target"])
        result["topics"][name] = {"demand": demand, "supply": supply, "overlap_candidates": t["overlap"]}

    for name, g in GENRES.items():
        supply, isbns = genre_supply(env, g, pool, rates["leaf"], pool_genre)
        demand = {band: {"kdc": kdc_demand(docs, g["kdc"]), "yes24_isbn": isbn_demand(docs, isbns)}
                  for band, docs in loans.items()}
        result["genres"][name] = {"demand": demand, "supply": supply, "boundary": g["boundary"],
                                  "axes_expected": g["axes"]}

    result["axis_balance_now"] = axis_balance(pool_books)
    result["failures"] = FAILURES
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print_summary(result)


def print_summary(r: dict) -> None:
    for band, L in r["loans"].items():
        print(f"\n[{band}] top {L['books']} books · loans {L['loans']:,} · exam share {L['exam_share']:.1%}")
        for k in L["kdc"][:22]:
            print(f"  {k['div']} {k['name']:<22} {k['share']:>6.1%}  {k['books']:>4}권  now: {k['galpi_now']}")
        print(f"  non-fiction share {L['nonfiction_share']:.1%} · current 🎯 title demand: "
              f"{r['current_target_demand'][band]['share']:.1%}")
        for sec, row in list(L["kdc_detail"].items())[:18]:
            print(f"    {sec} {row['name']:<30} {row['share']:>6.2%}  {row['books']:>4}권  {' / '.join(row['top'])}")
    print("\n🎯 candidates (20s share / 30s share · eligible → usable · keywords)")
    for name, t in r["topics"].items():
        d20, d30, s = t["demand"]["20s"], t["demand"]["30s"], t["supply"]
        kw = ", ".join(f"{k} {v['title_only']}~{v['books']}" for k, v in s["keywords"].items())
        print(f"  {name:<8} {d20['share']:.2%} [nf {d20['nonfiction_share']:.1%}] ({d20['books']}권) / "
              f"{d30['share']:.2%} · {s['eligible']} → {s['expected_usable']} · overlap {s['overlap_share']:.0%} · {kw}")
        print(f"           top: {' / '.join(d20['top'])}")
    print("\n🍃 candidates (20s KDC share · 20s YES24-isbn share · eligible → usable, ≤10y)")
    for name, g in r["genres"].items():
        d, s = g["demand"]["20s"], g["supply"]
        print(f"  {name:<6} {d['kdc']['share']:.2%} · {d['yes24_isbn']['share']:.2%} ({d['yes24_isbn']['books']}권) · "
              f"{s['eligible']} → {s['expected_usable']} ({s['within_10y']}) · pool {s['current_pool_books_in_these_lists']}")
    print("\nmonthly keywords:", ", ".join(f"{w}({m})" for w, m, _ in r["monthly_keywords"][:40]))
    if r["failures"]:
        print(f"\nAPI failures / empty {len(r['failures'])}:")
        for f in r["failures"][:30]:
            print("  ", f)
    print(f"\nsaved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
