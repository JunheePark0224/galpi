import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_PENDING } from "@/lib/privacy";
import PrivacyPage from "./page";

describe("/privacy (S-10)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it("shows the title, the date and the nine collected items", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByText(/2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText("갈피는 이름·전화번호를 받지 않아요.")).toBeInTheDocument();
    expect(screen.getByText(/이메일은 구글로 로그인할 때만, 로그인 확인용으로 로그인 서비스에 남아요\./)).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(10); // header + 9 (P5: login, Google email, 내 책갈피)
    expect(screen.getByRole("columnheader", { name: "모으는 것" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "왜" })).toBeInTheDocument();
    expect(screen.getByText("누른 버튼과 누른 시각, 고른 입구(🎯/🍃), 본 책갈피, 궁금해요/패스, 밸런스 게임 답과 답하는 데 걸린 시간, 고친 답, 몇 번째 뽑기인지")).toBeInTheDocument();
    expect(screen.getByText("기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 페이지 주소), 화면 버전")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /무엇을 알고 싶어요/ }))
      .toHaveTextContent("🎯 \"무엇을 알고 싶어요\" 칸에 적은 글 (최대 30자, 갈피의 데이터베이스에만 저장, 주제를 찾을 때 Anthropic에 보내요) — 그 글에서 찾은 주제·키워드는 Amplitude에도 함께 보내요");
    expect(screen.getByText("같은 사람이 다시 왔는지 세기 위해")).toBeInTheDocument();
    expect(screen.getByText("추천이 잘 맞는지 분석하기 위해")).toBeInTheDocument();
    expect(screen.getByText("화면이 잘 동작하는지 확인하기 위해")).toBeInTheDocument();
    expect(screen.getByText(/사람들이 찾는 주제를 알고 책을 늘리기 위해/)).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요")).toBeInTheDocument();
  });

  it("lists what Amplitude collects on its own and the sampled screen recording with masked inputs", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Amplitude가 자동으로 모으는 것: 페이지 주소(광고 태그 포함)와 페이지 이동, 누른 버튼·링크, 입력값을 뺀 입력 양식 사용 기록, 페이지 속도 측정, 같은 곳을 되풀이해 누르는 행동, 실패한 네트워크 요청 기록, 기기·브라우저 종류, 언어, IP 주소와 그걸로 짐작한 대략적인 지역")).toBeInTheDocument();
    expect(screen.getByText("화면 움직임 녹화 — 방문자 5명 중 1명꼴이고, 입력칸에 쓴 글은 가려서 저장돼요")).toBeInTheDocument();
    expect(screen.getByText("어디서 막히는지 다시 보기 위해")).toBeInTheDocument();
  });

  it("scopes the one-year deletion to Supabase and names the hosts", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("수집일로부터 1년이 지나면 자동으로 지워져요.")).toBeInTheDocument();
    expect(screen.getByText(/Supabase\(데이터베이스 서비스\)에 저장된 기록은/)).toBeInTheDocument();
    expect(screen.getByText(/사이트는 Vercel에서 운영돼요. 두 서비스의 서버는 해외에 있을 수 있어요./)).toBeInTheDocument();
    expect(screen.getByText(/Amplitude에 전달된 기록은 Amplitude가 따로 보관해요/)).toBeInTheDocument();
  });

  it("discloses Amplitude instead of promising to share with nobody", () => {
    render(<PrivacyPage />);
    expect(screen.queryByRole("heading", { name: "다른 곳에 주지 않아요." })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "기록을 전달하는 곳" })).toBeInTheDocument();
    expect(screen.getByText(/분석 서비스 Amplitude\(서버는 미국에 있어요\)에도 보내요/)).toBeInTheDocument();
    expect(screen.getByText(/Amplitude는 브라우저의 쿠키와 저장 공간에 식별 값을 남겨요/)).toBeInTheDocument();
    expect(screen.getByText(/새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요/)).toBeInTheDocument();
  });

  it("says the written goal stays in Galpi's database and is not sent to Amplitude (taxonomy 6-3)", () => {
    render(<PrivacyPage />);
    const onlyHere = screen.getByText("다만 🎯 \"무엇을 알고 싶어요\" 칸에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.");
    expect(onlyHere.tagName).toBe("STRONG");
    expect(onlyHere.closest("section")).toHaveTextContent(/위 기록은 분석 서비스 Amplitude\(서버는 미국에 있어요\)에도 보내요\. 다만/);
    expect(screen.getByText("갈피의 데이터베이스에만 저장").tagName).toBe("STRONG");
  });

  it("names Anthropic as where the written goal goes for sorting, and only that text (P4, taxonomy 6-2)", () => {
    render(<PrivacyPage />);
    const sent = screen.getByText(/에 적은 글은 우리 주제·키워드 중 어디에 맞는지 찾으려고 Anthropic\(AI 서비스 Claude, 서버는 미국에 있어요\)에 보내요\.$/);
    expect(sent.tagName).toBe("STRONG");
    const section = sent.closest("section");
    expect(section).toHaveTextContent("보내는 것은 그 글(최대 30자)뿐이고, 익명 번호나 다른 기록은 함께 보내지 않아요. 예시 칩의 말을 그대로 내면 Anthropic에 보내지 않아요.");
    expect(screen.queryByText(/직접 쓰기/)).toBeNull();   // 입력 B: no [직접 쓰기] control any more
    expect(section).toHaveTextContent("Anthropic은 API로 받은 글을 AI 학습에 쓰지 않고, 30일 안에 지운다고 밝히고 있어요");
    expect(section).toHaveTextContent("이 밖의 곳에는 주지 않아요.");
    expect(screen.getByRole("cell", { name: /주제를 찾을 때 Anthropic에 보내요/ })).toBeInTheDocument();
  });

  it("says the YES24 search link sends only the short missing phrase, as a search word (F-24)", () => {
    render(<PrivacyPage />);
    const yes24 = screen.getByText("첫 장에서 [예스24에서 찾기]를 누르면, 그 글에서 찾은 짧은 말(예: '캠핑 장비')만 검색어로 예스24에 보내요.");
    expect(yes24.tagName).toBe("STRONG");
    expect(yes24.closest("p")).toHaveTextContent("글이 짧으면 그 말이 글과 같을 수 있어요. 익명 번호는 보내지 않아요.");
    expect(yes24.closest("p")).not.toHaveTextContent("적은 글 전체");   // not guaranteed: a short note can be the phrase itself
    expect(screen.getByRole("cell", { name: /무엇을 알고 싶어요/ }))
      .toHaveTextContent("갈피에 아직 없는 걸 찾았다면 그걸 가리키는 짧은 말도 데이터베이스에만 저장해요");
  });

  it("says Amplitude records are deleted together with the rest on request", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/그 번호의 기록을 모두 지워요. Amplitude에 전달된 기록도 함께 지워요/)).toBeInTheDocument();
  });

  it("shows the fallback line when no contact email is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "");
    render(<PrivacyPage />);
    expect(screen.getByText(CONTACT_PENDING)).toBeInTheDocument();
    expect(CONTACT_PENDING).toBe("문의 이메일은 곧 적어 둘게요");
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("links the contact email with mailto when it is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@example.com");
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: "hello@example.com" });
    expect(link).toHaveAttribute("href", "mailto:hello@example.com");
    expect(screen.queryByText(CONTACT_PENDING)).not.toBeInTheDocument();
  });

  it("shows the anonymous id block without creating an id", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("ends with the disclaimer and a way back to the start", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("갈피는 예스24와 무관한 개인 포트폴리오 프로젝트예요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "처음으로" })).toHaveAttribute("href", "/");
  });

  it("lists what logging in keeps — user number, method, first login — and that later records carry the number (P5, taxonomy 6-3d)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/로그인했다면: 사용자 번호\(로그인 서비스가 만든 무작위 번호\), 로그인 방법\(카카오\/구글\), 처음 로그인한 때/)).toBeInTheDocument();
    expect(screen.getByText(/로그인한 뒤의 기록에는 이 사용자 번호가 붙어요/)).toBeInTheDocument();
  });

  it("says the Google email stays only in the login service, and Kakao gives none (P5 decision 1)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/구글로 로그인하면 구글이 주는 이메일 주소가 로그인 서비스\(Supabase Auth\) 저장소에 남아요/)).toBeInTheDocument();
    expect(screen.getByText(/기록·분석에는 쓰지 않고, Amplitude에도 보내지 않아요/)).toBeInTheDocument();
    expect(screen.getByText(/카카오로 로그인하면 이메일을 받지 않아요/)).toBeInTheDocument();
  });

  it("lists 내 책갈피 with the rod names kept only in Galpi's database", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/내 책갈피: 꽂은 책, 그때 책갈피 그림, 만난 날, 나온 이유, 막대와 막대 이름/)).toBeInTheDocument();
    expect(screen.getByText("막대 이름은 직접 쓴 글이라 갈피의 데이터베이스에만 저장")).toBeInTheDocument();
    expect(screen.getByText(/내 책갈피와 로그인 정보는 탈퇴를 요청할 때까지 보관해요/)).toBeInTheDocument();
  });

  it("names Kakao and Google as where logging in takes you, and how to log out or leave", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/로그인 버튼을 누르면 카카오나 구글의 로그인 화면으로 이동해요/)).toBeInTheDocument();
    expect(screen.getByText(/로그아웃은 내 책갈피 화면 맨 아래에서 할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByText(/탈퇴하려면 로그인한 방법과 아래 익명 번호를 적어 문의 이메일로 보내 주세요/)).toBeInTheDocument();
  });
});
