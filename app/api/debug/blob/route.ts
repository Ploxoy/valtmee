import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BlobDiagnostic = {
  env: {
    hasBlobReadWriteToken: boolean;
    hasBlobStoreId: boolean;
    hasVercelOidcToken: boolean;
    blobConfigured: boolean;
  };
  list: {
    ok: boolean;
    error: string | null;
    count: number;
    blobs: Array<{
      pathname: string;
      size: number;
      uploadedAt: string;
    }>;
  };
};

function isBlobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  const diagnostic: BlobDiagnostic = {
    env: {
      hasBlobReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      hasBlobStoreId: Boolean(process.env.BLOB_STORE_ID),
      hasVercelOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
      blobConfigured: isBlobConfigured(),
    },
    list: {
      ok: false,
      error: null,
      count: 0,
      blobs: [],
    },
  };

  if (!diagnostic.env.blobConfigured) {
    diagnostic.list.error = "Blob environment is not available in this runtime.";
    return Response.json(diagnostic, { status: 200 });
  }

  try {
    const result = await list({ limit: 100 });
    diagnostic.list.ok = true;
    diagnostic.list.count = result.blobs.length;
    diagnostic.list.blobs = result.blobs.map((blob) => ({
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
    }));
  } catch (error) {
    diagnostic.list.error = toErrorMessage(error);
  }

  return Response.json(diagnostic, { status: 200 });
}
