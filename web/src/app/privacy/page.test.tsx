import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_PENDING } from "@/lib/privacy";
import PrivacyPage from "./page";

const ACTIONS = "누른 버튼과 누른 시각, 질문마다 고른 답(둘 중 하나 또는 \"갈피를 못 잡겠어요\")과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기), 본 책갈피, 궁금해요/패스, 몇 번째 뽑기인지";

describe("/privacy (S-10)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it("shows the title, the date and the eleven collected items (v2: no written goal; 도감 v1 row; v1.4 link tags)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByText(/2026-10-05/)).toBeInTheDocument();
    expect(screen.getByText("갈피는 이름·전화번호를 받지 않아요.")).toBeInTheDocument();
    expect(screen.getByText(/이메일·닉네임은 로그인할 때 로그인 확인용으로 로그인 서비스에만 남고, 갈피는 쓰지 않아요\./)).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(12); // header + 11 (v2: the 🎯 written-goal row is gone; 도감 v1 adds one; taxonomy v1.4 the link tags)
    expect(screen.getByText(/도감: 로그인했다면, 책을 넘기며 만난 책갈피 그림의 동물·배경·소품과 각각 처음 만난 때와 그때의 그림/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "모으는 것" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "왜" })).toBeInTheDocument();
    expect(screen.getByText(ACTIONS)).toBeInTheDocument();
    expect(screen.getByText("기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 사이트의 이름만 — 예: instagram.com, 주소 전체는 저장하지 않아요), 화면 버전")).toBeInTheDocument();
    expect(screen.getByText("홍보 링크로 들어왔다면 그 링크에 붙은 표시 (어디에 올린 어떤 홍보인지 — 예: threads, social, launch_1007). 읽은 뒤 주소창에서 지워요")).toBeInTheDocument();
    expect(screen.getByText("어느 홍보로 몇 명이 왔는지 세기 위해")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: /무엇을 알고 싶어요/ })).toBeNull();
    expect(screen.getByText("같은 사람이 다시 왔는지 세기 위해")).toBeInTheDocument();
    expect(screen.getByText("추천이 잘 맞는지 분석하기 위해")).toBeInTheDocument();
    expect(screen.getByText("화면이 잘 동작하는지 확인하기 위해")).toBeInTheDocument();
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

  it("says no written goal is taken and nothing goes to Anthropic any more, and what happens to old notes (v2, taxonomy 6-3f)", () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/Anthropic에 보내요/)).toBeNull();
    expect(screen.queryByText(/예스24에서 찾기/)).toBeNull();
    const old = screen.getByText("이제 갈피는 직접 쓴 목표 글을 받지 않고, 어떤 글도 AI 서비스(Anthropic)에 보내지 않아요.");
    expect(old.tagName).toBe("STRONG");
    expect(old.closest("p")).toHaveTextContent("예전 화면의 🎯 \"무엇을 알고 싶어요\" 칸에 적은 글은 갈피의 데이터베이스에만 남아 있다가, 수집일로부터 1년이 지나면 다른 기록과 함께 지워져요.");
    expect(screen.getByText(/이 밖의 곳에는 주지 않아요\./)).toBeInTheDocument();
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
    expect(screen.getByText(/카카오로 로그인할 때 이메일·닉네임·프로필 사진 제공에 동의하면 그 값도 로그인 서비스 저장소에만 남아요 — 동의하지 않아도 로그인돼요/)).toBeInTheDocument();
  });

  it("lists 내 책갈피 with the rod names kept only in Galpi's database", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/내 책갈피: 꽂은 책, 그때 책갈피 그림, 만난 날, 나온 이유, 막대와 막대 이름/)).toBeInTheDocument();
    expect(screen.getByText("막대 이름은 직접 쓴 글이라 갈피의 데이터베이스에만 저장")).toBeInTheDocument();
    expect(screen.getByText(/내 책갈피, 도감과 로그인 정보는 탈퇴를 요청할 때까지 보관해요/)).toBeInTheDocument();
    expect(screen.queryByText(/내 책갈피와 로그인 정보는/)).toBeNull();   // 도감 is kept until account deletion too, not one year
  });

  it("names Kakao and Google as where logging in takes you, and how to log out or leave", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/로그인 버튼을 누르면 카카오나 구글의 로그인 화면으로 이동해요/)).toBeInTheDocument();
    expect(screen.getByText(/로그아웃은 내 책갈피 화면 맨 아래에서 할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByText(/탈퇴하려면 로그인한 방법과 아래 익명 번호를 적어 문의 이메일로 보내 주세요/)).toBeInTheDocument();
    expect(screen.getByText(/계정과 내 책갈피, 도감, 기록을 함께 지워요/)).toBeInTheDocument();
  });

  it("lists the 갈피 우체통 letter — kept in Galpi's database with the anonymous number, only its length to Amplitude (F-26, taxonomy 6-3e)", () => {
    render(<PrivacyPage />);
    const cell = screen.getByRole("cell", { name: /갈피 우체통에 적은 글/ });
    expect(cell).toHaveTextContent("갈피 우체통에 적은 글 (최대 500자)과 보낸 때 — 익명 번호 등 다른 기록과 같은 정보(로그인했다면 사용자 번호)와 함께 갈피의 데이터베이스(Supabase)에만 저장, Amplitude에는 글자 수만 보내요");
    expect(screen.getByText("우체통 글에 이름·연락처는 적지 마세요").tagName).toBe("STRONG");
  });

  it("says the letter is not sent to Amplitude and the notice email carries only the arrival time (F-26)", () => {
    render(<PrivacyPage />);
    const only = screen.getByText("갈피 우체통에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.");
    expect(only.tagName).toBe("STRONG");
    const p = only.closest("p");
    expect(p).toHaveTextContent("글이 도착하면 운영자에게 알림 메일이 가요(메일 발송 서비스 Resend — 서버는 해외에 있을 수 있어요).");
    expect(p).toHaveTextContent("그 메일에는 도착 시각만 들어가고, 적은 글이나 익명 번호는 들어가지 않아요.");
  });
});
