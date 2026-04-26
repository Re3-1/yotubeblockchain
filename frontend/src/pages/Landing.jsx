import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <section className="py-20 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-brand">
        Own a piece of your favourite YouTuber.
      </h1>
      <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
        A decentralized marketplace where creators tokenize their channels
        and fans trade those tokens, earn royalties-back through milestone
        predictions, and collect NFT badges.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/dashboard"
          className="bg-brand text-white px-6 py-3 rounded font-medium"
        >
          I&apos;m a creator
        </Link>
        <Link
          to="/marketplace"
          className="bg-white border border-brand text-brand px-6 py-3 rounded font-medium"
        >
          I&apos;m a fan
        </Link>
      </div>
    </section>
  );
}
