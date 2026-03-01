import { NextRequest, NextResponse } from "next/server";
import { copyFileSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const CONFIG_PATH = path.join(OPENCLAW_DIR, "openclaw.json");

export async function GET() {
  try {
    const text = readFileSync(CONFIG_PATH, "utf-8");
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Config read error:", error);
    return NextResponse.json(
      { error: "Config dosyasi okunamadi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Config metni bos olamaz" },
        { status: 400 }
      );
    }

    // Validate JSON before writing
    JSON.parse(text);

    const backupPath = `${CONFIG_PATH}.bak.${Date.now()}`;
    copyFileSync(CONFIG_PATH, backupPath);
    writeFileSync(CONFIG_PATH, text, "utf-8");

    return NextResponse.json({
      success: true,
      backupPath,
      message: "Config kaydedildi",
    });
  } catch (error) {
    console.error("Config write error:", error);
    return NextResponse.json(
      { error: "Config kaydedilemedi" },
      { status: 500 }
    );
  }
}
