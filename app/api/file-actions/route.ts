import { NextResponse } from "next/server";
import { getAllowedFileRoots, isFilePathAllowed } from "@/lib/file-access";
import {
  buildEditorCommand,
  buildFileManagerCommand,
  launchDetachedCommand,
  parseEditorActionRequest,
  resolveAllowedEditorFile,
  resolveAllowedFileManagerTarget,
  validateCustomExecutable,
} from "@/lib/editor-launch";
import type { EditorSelection } from "@/lib/editor-config";

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function fileErrorResponse(error: unknown): NextResponse {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return errorResponse("File not found", 404);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message === "Access denied" || message.includes("symbolic link")) {
    return errorResponse("Access denied", 403);
  }
  return errorResponse(message, 400);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Invalid file action request", 400);
  }

  const action = (body as Record<string, unknown>).action;
  if (action === "reveal") {
    const filePath = (body as Record<string, unknown>).filePath;
    if (typeof filePath !== "string") {
      return errorResponse("Invalid file action request", 400);
    }

    let roots: Set<string>;
    try {
      roots = await getAllowedFileRoots();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(`Failed to resolve allowed file roots: ${message}`, 500);
    }

    let target;
    try {
      target = resolveAllowedFileManagerTarget(filePath, roots, isFilePathAllowed);
    } catch (error) {
      return fileErrorResponse(error);
    }

    const command = buildFileManagerCommand(target);
    try {
      await launchDetachedCommand(command.command, command.args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(`Failed to open file manager: ${message}`, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action !== "edit") {
    return errorResponse("Unsupported file action", 400);
  }

  const request = parseEditorActionRequest(body);
  if (!request) {
    return errorResponse("Invalid editor action request", 400);
  }

  const selection: EditorSelection = {
    id: request.editorId,
    executablePath: request.customExecutable ?? "",
  };

  let roots: Set<string>;
  try {
    roots = await getAllowedFileRoots();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`Failed to resolve allowed file roots: ${message}`, 500);
  }

  let filePath: string;
  try {
    filePath = resolveAllowedEditorFile(request.filePath, roots, isFilePathAllowed);
  } catch (error) {
    return fileErrorResponse(error);
  }

  if (selection.id === "custom") {
    const validationError = validateCustomExecutable(selection.executablePath);
    if (validationError) return errorResponse(validationError, 400);
  }

  let editorCommand;
  try {
    editorCommand = buildEditorCommand(selection, filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(message, 400);
  }

  try {
    await launchDetachedCommand(editorCommand.command, editorCommand.args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`Failed to launch editor: ${message}`, 500);
  }

  return NextResponse.json({ success: true });
}
