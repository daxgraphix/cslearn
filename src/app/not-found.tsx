import Link from "next/link";
export default function NotFound() { return (<main className="grid min-h-screen place-items-center p-4"><div className="text-center"><h1 className="text-2xl font-semibold">Page not found</h1><Link className="btn-primary mt-4" href="/courses">Browse courses</Link></div></main>); }
