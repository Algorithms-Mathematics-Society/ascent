import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

export type CertificateVerification = Readonly<{
  rank: number;
  code: string;
}>;

const VERIFICATION_CODES = [
  "5JHT-G97D", "J73A-GT3M", "J2DE-GKXY", "V7UP-RFCY", "YJP9-NM54", "2C5Z-Q7G3", "QXQS-9J98", "CSPS-AS4J", "QYJN-AJY4", "KCFH-9FUN",
  "J4RK-NSJJ", "TQW5-4QQW", "JETV-6M7M", "GXBV-UEXS", "XXTM-TGWW", "CW4X-3ZG4", "KJSH-VBWT", "7CNP-P3SD", "JRVB-74E2", "4A4U-SEP9",
  "HPN6-RJ2D", "Y7EP-V9FW", "P5PV-PNWQ", "GZWN-XQCE", "5HMY-FZQ7", "J3U3-93VF", "G5PH-WAQ7", "WRJJ-ESQQ", "WNYZ-CHJR", "4MYF-34TK",
  "6RA6-7SBZ", "5SJV-Z3DQ", "2SHN-H3JB", "MAC2-JBMQ", "QPA3-BNGM", "P9G9-UECV", "6EW7-489M", "C3T2-NFGJ", "BK7E-Z8J6", "XC7C-RDNJ",
  "538E-JYGZ", "HYPE-6XNH", "BHH3-RQ7Z", "83YA-F7XC", "NYKG-BMQC", "9WSN-7S6A", "4H83-GFHT", "DQDX-CTW7", "X34F-9X79", "FR2F-G7EW",
  "36R8-HZZE", "6H6D-VYG7", "6UAX-DN58", "895D-874D", "9RM3-YFJX", "GG7Y-4Y3Y", "KME6-QPXT", "R97Z-CW2V", "JE4K-34TD", "2H4S-J63U",
  "JT9E-A3J3", "T4HD-9PBQ", "QWKB-Y8YB", "V93Z-5SQ9", "9A4R-S5DC", "WFGC-XFSM", "G499-FGHY", "UVCW-SVV6", "N4Q9-ZAKM", "MYAJ-U4TM",
  "ZBJ9-UTEK", "GEKK-BMNV", "E28T-X68C", "RVP5-HBX9", "9PHX-3FKX", "2WK5-DX5G", "HP3D-5AD9", "XW9T-ZGE9", "3R4A-QQD7", "9HWS-ZVFF",
  "2RZP-BWN6", "TMYJ-RRH3", "PMTF-E35Q", "RCKY-EKVD", "FWD4-6VVT", "WZTU-EPDC", "GUG7-VZ8S", "VANT-GWSJ", "4Y72-E38Y", "BNWD-HNNZ",
  "9P9M-WMP3", "4D8V-YJT4", "SH9F-H579", "2KCM-JZGH", "98GP-JZ9J", "QH6G-Y7HR", "AGCN-74BG", "VX8G-RSUD", "9X5W-4PZA", "5AN6-8UHR",
  "FN6M-8M9T", "7BTG-SKP3", "8WPN-AMCG", "CYRV-MYP3", "BYGP-JAEZ", "FA6H-KVHW", "7EM7-JDA4", "NHZC-9A57", "7Q3Z-V6AG", "WZPN-PURP",
  "DZ7Q-JQ2M", "SG9S-RQR3", "M345-SU3D", "G84C-F7VX", "KYBB-FD3A", "MA9M-MJPN", "K7S7-SE8T", "6XN5-M94T", "SK47-W9EH", "RUHK-B4A6",
  "MFVU-QC9R", "NHRW-SF9R", "B4AZ-48K7", "4R3E-24JP", "Z6SJ-A3ZG", "NM5P-W3X2", "8D23-NHAA", "MNFZ-TWET", "XQXQ-PVGQ", "6U9G-F3WD",
  "MBVR-H2XJ", "N8NS-EUPJ", "G4QE-M8BH",
] as const;

if (VERIFICATION_CODES.length !== ROUND_ONE_SELECTION_COUNT) {
  throw new Error("Certificate verification data must cover every selected rank.");
}

export const CERTIFICATE_VERIFICATIONS: readonly CertificateVerification[] =
  VERIFICATION_CODES.map((code, index) => ({ rank: index + 1, code }));

const BY_CODE = new Map(CERTIFICATE_VERIFICATIONS.map((entry) => [entry.code, entry]));

export function normalizeVerificationCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : value.trim().toUpperCase();
}

export function findCertificateVerification(value: string): CertificateVerification | null {
  return BY_CODE.get(normalizeVerificationCode(value)) ?? null;
}

export function getVerificationContext(rank: number) {
  const topPercent = Math.ceil((rank / ROUND_ONE_SELECTION_COUNT) * 100);
  const distinction = rank <= 10 ? "Top 10 published rank" : rank <= 25 ? "Top 25 published rank" : rank <= 50 ? "Top 50 published rank" : "Round 2 qualifier";
  return { topPercent, distinction };
}
