import { NextResponse } from "next/server";
import { homedir } from "os";
import { allowFileRoot } from "@/lib/file-access";
import { ensureDefaultWorkspaceDirectory } from "@/lib/default-workspace";

// POST /api/default-cwd
// Creates ~/.pi/default-workspace/<YYYYMMDD> if it doesn't exist and returns the path.
export async function POST() {
  try {
    const dir = ensureDefaultWorkspaceDirectory(homedir(), new Date());
    allowFileRoot(dir);
    return NextResponse.json({ cwd: dir });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
