import type { Metadata } from "next";
import Link from "next/link";
import { AnonIdView } from "@/components/privacy/AnonIdView";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "개인정보 처리방침 · 갈피" };

export const UPDATED = "2026-09-30";
export const CONTACT_PENDING = "문의 이메일은 곧 적어 둘게요";

/** Inlined at build time; empty until the contact address exists — the page still works. */
function Contact() {
  const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();
  if (!email) return <>{CONTACT_PENDING}</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}

/** S-10 v0 (F-16): only what is collected before login. Login, saves, Anthropic and Amplitude join with those features. */
export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <header>
        <h1 className={styles.title}>개인정보 처리방침</h1>
        <p className={styles.updated}>갱신일 {UPDATED}</p>
      </header>

      <p className={styles.lead}>
        <strong>갈피는 이름·이메일·전화번호를 받지 않아요.</strong> 더 나은 책 추천을 연구하려고 아래 정보만 모아요.
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
            <td>누른 버튼, 본 책갈피, 궁금해요/패스, 밸런스 게임 답</td>
            <td>추천이 잘 맞는지 분석하기 위해</td>
          </tr>
          <tr>
            <td>기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 페이지 주소)</td>
            <td>화면이 잘 동작하는지 확인하기 위해</td>
          </tr>
          <tr>
            <td>🎯 {"\"직접 쓰기\""}에 적은 글 (최대 30자)</td>
            <td>사람들이 찾는 주제를 알고 책을 늘리기 위해 — <strong>이름·연락처는 적지 마세요</strong></td>
          </tr>
        </tbody>
      </table>

      <section className={styles.section}>
        <h2 className={styles.h2}>보관</h2>
        <p>
          모은 정보는 Supabase(데이터베이스 서비스)에 저장되고, <strong>수집일로부터 1년이 지나면 자동으로 지워져요.</strong>{" "}
          사이트는 Vercel에서 운영돼요.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>다른 곳에 주지 않아요.</h2>
        <p>새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>지우고 싶다면</h2>
        <p>아래 익명 번호를 적어 문의 이메일로 보내 주세요. 그 번호의 기록을 모두 지워요.</p>
        <AnonIdView />
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>문의</h2>
        <p><Contact /></p>
      </section>

      <footer className={styles.end}>
        <p>갈피는 예스24와 무관한 개인 포트폴리오 프로젝트예요.</p>
        <Link href="/" className={styles.back}>처음으로</Link>
      </footer>
    </article>
  );
}
