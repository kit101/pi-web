import { homedir } from "os";
import { NextRequest, NextResponse } from "next/server";
import {
  DirectoryBrowserError,
  getBrowsableParent,
  listBrowsableDirectories,
  resolveBrowsableDirectory,
} from "@/lib/directory-browser";
import { getAllowedFileRoots, isFilePathAllowed } from "@/lib/file-access";

export async function GET(request: NextRequest) {
  try {
    const requestedPath = request.nextUrl.searchParams.get("path");
    const home = homedir();
    const allowedFileRoots = await getAllowedFileRoots();
    const location = resolveBrowsableDirectory(
      requestedPath ?? home,
      [home, ...allowedFileRoots],
      isFilePathAllowed,
    );

    return NextResponse.json({
      path: location.directory,
      root: location.root,
      parent: getBrowsableParent(location.directory, location.root, isFilePathAllowed),
      entries: listBrowsableDirectories(location.directory),
    });
  } catch (error) {
    if (error instanceof DirectoryBrowserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
