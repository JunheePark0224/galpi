import type { Metadata } from "next";
import { AnonIdView } from "@/components/privacy/AnonIdView";
import { GuideReset } from "@/components/privacy/GuideReset";
import { CONTACT_PENDING, UPDATED } from "@/lib/privacy";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "개인정보 처리방침 · 갈피" };

/** Inlined at build time; empty until the contact address exists — the page still works. */
function Contact() {
  const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();
  if (!email) return <>{CONTACT_PENDING}</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}

/**
 * S-10 (F-16): what is collected and where it goes — Amplitude, (P5, taxonomy 6-3d) login, the Google email kept by the
 * login service only, 내 책갈피, (F-26, taxonomy 6-3e) the 갈피 우체통 letter — Supabase only, a time-only notice email
 * through Resend. v2 (taxonomy 6-3f): no written goal, nothing to Anthropic; question answers instead of the balance game.
 * 도감 v1 (taxonomy 6-3g): the picture parts a logged-in person met, when first, and the picture they were met in.
 * v1.7 (taxonomy 6-3j): bookmarks kept before logging in live in this browser only, until the login moves them.
 */
export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <header>
        <h1 className={styles.title}>개인정보 처리방침</h1>
        <p className={styles.updated}>갱신일 {UPDATED}</p>
      </header>

      <p className={styles.lead}>
        <strong>갈피는 이름·전화번호를 받지 않아요.</strong> 이메일·닉네임은 로그인할 때 로그인 확인용으로 로그인 서비스에만 남고, 갈피는 쓰지 않아요.
        더 나은 책 추천을 연구하려고 아래 정보만 모아요.
      </p>

      <table className={styles.table}>
        <thead>
          <tr><th scope="col">모으는 것</th><th scope="col">왜</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>익명 번호 (이 브라우저에 저장되는 무작위 번호), 방문 번호</td>
            <td>같은 사람이 다시 왔는지 세기 위해</td>
          </tr>
          <tr>
            <td>누른 버튼과 누른 시각, 질문마다 고른 답(둘 중 하나 또는 {"\"갈피를 못 잡겠어요\""})과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기), 본 책갈피, 궁금해요/패스, 몇 번째 뽑기인지</td>
            <td>추천이 잘 맞는지 분석하기 위해</td>
          </tr>
          <tr>
            <td>기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 사이트의 이름만 — 예: instagram.com, 주소 전체는 저장하지 않아요), 화면 버전</td>
            <td>화면이 잘 동작하는지 확인하기 위해</td>
          </tr>
          <tr>
            <td>홍보 링크로 들어왔다면 그 링크에 붙은 표시 (어디에 올린 어떤 홍보인지 — 예: threads, social, launch_1007). 읽은 뒤 주소창에서 지워요</td>
            <td>어느 홍보로 몇 명이 왔는지 세기 위해</td>
          </tr>
          <tr>
            <td>로그인했다면: 사용자 번호(로그인 서비스가 만든 무작위 번호), 로그인 방법(카카오/구글), 처음 로그인한 때. 로그인한 뒤의 기록에는 이 사용자 번호가 붙어요</td>
            <td>다른 기기에서도 내 책갈피를 보여 주고, 로그인 전·후 기록을 한 사람으로 이어 분석하기 위해</td>
          </tr>
          <tr>
            <td>구글로 로그인하면 구글이 주는 이메일 주소가 로그인 서비스(Supabase Auth) 저장소에 남아요 — 기록·분석에는 쓰지 않고, Amplitude에도 보내지 않아요. 카카오로 로그인할 때 이메일·닉네임·프로필 사진 제공에 동의하면 그 값도 로그인 서비스 저장소에만 남아요 — 동의하지 않아도 로그인돼요</td>
            <td>로그인을 확인하기 위해 (구글이 늘 함께 보내는 값이에요)</td>
          </tr>
          <tr>
            <td>내 책갈피: 꽂은 책, 그때 책갈피 그림(도감에 모은 것으로 꾸몄다면 꾸민 그림도), 만난 날, 나온 이유, 막대와 막대 이름 (<strong>막대 이름은 직접 쓴 글이라 갈피의 데이터베이스에만 저장</strong>)</td>
            <td>내 책갈피를 다시 보여 주기 위해 — <strong>막대 이름에 이름·연락처는 적지 마세요</strong></td>
          </tr>
          <tr>
            <td>로그인 전에 저장한 책갈피(책 번호·책갈피 그림·나온 이유·만난 날)는 이 브라우저에만 저장돼요. 로그인하면 계정으로 옮기고 브라우저에서 지워요. 브라우저 기록을 지우면 함께 사라져요.</td>
            <td>로그인하지 않아도 책갈피를 모아 두었다가 로그인하면 이어 주기 위해</td>
          </tr>
          <tr>
            <td>도감: 로그인했다면, 책을 넘기며 만난 책갈피 그림의 동물·배경·소품과 각각 처음 만난 때와 그때의 그림을 갈피의 데이터베이스에 저장해요 (어떤 책이었는지는 넣지 않아요)</td>
            <td>만난 책갈피를 도감에 모아 보여 주기 위해</td>
          </tr>
          <tr>
            <td>갈피 우체통에 적은 글 (최대 500자)과 보낸 때 — 익명 번호 등 다른 기록과 같은 정보(로그인했다면 사용자 번호)와 함께 <strong>갈피의 데이터베이스(Supabase)에만 저장</strong>, Amplitude에는 글자 수만 보내요</td>
            <td>써 본 분들의 의견을 읽고 갈피를 고치기 위해 — <strong>우체통 글에 이름·연락처는 적지 마세요</strong></td>
          </tr>
          <tr>
            <td>Amplitude가 자동으로 모으는 것: 페이지 주소(광고 태그 포함)와 페이지 이동, 누른 버튼·링크, 입력값을 뺀 입력 양식 사용 기록, 페이지 속도 측정, 같은 곳을 되풀이해 누르는 행동, 실패한 네트워크 요청 기록, 기기·브라우저 종류, 언어, IP 주소와 그걸로 짐작한 대략적인 지역</td>
            <td>어디서 그만두는지 살펴보기 위해</td>
          </tr>
          <tr>
            <td>화면 움직임 녹화 — 방문자 5명 중 1명꼴이고, 입력칸에 쓴 글은 가려서 저장돼요</td>
            <td>어디서 막히는지 다시 보기 위해</td>
          </tr>
        </tbody>
      </table>

      <section className={styles.section}>
        <h2 className={styles.h2}>보관</h2>
        <p>
          Supabase(데이터베이스 서비스)에 저장된 기록은 <strong>수집일로부터 1년이 지나면 자동으로 지워져요.</strong>{" "}
          사이트는 Vercel에서 운영돼요. 두 서비스의 서버는 해외에 있을 수 있어요.
        </p>
        <p>
          Amplitude에 전달된 기록은 Amplitude가 따로 보관해요.
        </p>
        <p>
          내 책갈피, 도감과 로그인 정보는 탈퇴를 요청할 때까지 보관해요.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>기록을 전달하는 곳</h2>
        <p>
          위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요.{" "}
          Amplitude는 브라우저의 쿠키와 저장 공간에 식별 값을 남겨요.
        </p>
        <p>
          <strong>이제 갈피는 직접 쓴 목표 글을 받지 않고, 어떤 글도 AI 서비스(Anthropic)에 보내지 않아요.</strong>{" "}
          예전 화면의 🎯 {"\"무엇을 알고 싶어요\""} 칸에 적은 글은 갈피의 데이터베이스에만 남아 있다가, 수집일로부터 1년이 지나면 다른 기록과 함께 지워져요.
        </p>
        <p>
          <strong>갈피 우체통에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요.</strong>{" "}
          글이 도착하면 운영자에게 알림 메일이 가요(메일 발송 서비스 Resend — 서버는 해외에 있을 수 있어요).
          그 메일에는 도착 시각만 들어가고, 적은 글이나 익명 번호는 들어가지 않아요.
        </p>
        <p>
          <strong>로그인 버튼을 누르면 카카오나 구글의 로그인 화면으로 이동해요.</strong>{" "}
          그 회사가 받는 정보는 그 회사의 처리방침을 따르고, 갈피가 돌려받는 것은 로그인했다는 확인과 사용자 번호(동의한 경우 이메일·닉네임·프로필 사진 포함)뿐이에요.
          로그인한 뒤의 기록은 사용자 번호와 함께 Amplitude에도 보내요. 막대 이름은 보내지 않아요.
          이 밖의 곳에는 주지 않아요. 새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>지우고 싶다면</h2>
        <p>아래 익명 번호를 적어 문의 이메일로 보내 주세요. 그 번호의 기록을 모두 지워요. Amplitude에 전달된 기록도 함께 지워요.</p>
        <p>
          로그아웃은 내 책갈피 화면 맨 아래에서 할 수 있어요 — 이 기기에서 연결만 끊고, 내 책갈피는 그대로 남아요.{" "}
          탈퇴하려면 로그인한 방법과 아래 익명 번호를 적어 문의 이메일로 보내 주세요. 계정과 내 책갈피, 도감, 기록을 함께 지워요.
        </p>
        <AnonIdView />
        <GuideReset />
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>문의</h2>
        <p><Contact /></p>
      </section>

      <footer className={styles.end}>
        <p>갈피는 예스24와 무관한 개인 포트폴리오 프로젝트예요.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full navigation on purpose: the flow starts at S-01 (loadFlow) */}
        <a href="/" className={styles.back}>처음으로</a>
      </footer>
    </article>
  );
}
