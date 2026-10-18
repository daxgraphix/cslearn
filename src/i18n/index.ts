import { cookies } from "next/headers";
import en from "./en.json";

export type Locale = "en";
const dict = { en } as const;
export type MessageKey = keyof typeof en;

export async function getLocale(): Promise<Locale> {
  void cookies;
  return "en";
}
export async function getT() {
  const l = await getLocale();
  return (key: MessageKey) => (dict[l] as Record<string, string>)[key] ?? dict.en[key] ?? key;
}
