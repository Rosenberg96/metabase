export function insertContentSecurityPolicyMetaTag(
  cspPolicy: string | null | undefined,
) {
  if (!cspPolicy?.trim()) {
    throw new Error("Content security policy is required.");
  }

  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";

  // frame-ancestors is not supported in meta tags
  meta.content = cspPolicy
    .split(";")
    .filter((directive) => !/^\s*frame-ancestors(?:\s|$)/i.test(directive))
    .join(";");

  document.head.appendChild(meta);
}
