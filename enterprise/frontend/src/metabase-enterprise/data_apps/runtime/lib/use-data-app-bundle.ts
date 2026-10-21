import { type ComponentType, useEffect, useState } from "react";

import type { DataAppMetabaseProviderProps } from "metabase-enterprise/data_apps/sandbox/types";

import {
  DataAppBundleError,
  fetchDataAppBundleCode,
  instantiateDataAppBundle,
} from "../loader";

import { describeError } from "./describe-error";
import { insertContentSecurityPolicyMetaTag } from "./embedded-content-security-policy";
import { reportErrorToParent } from "./report-error-to-parent";

export interface LoadedApp {
  component: ComponentType<Record<string, unknown>>;
  providerProps: DataAppMetabaseProviderProps;
}

/**
 * Loads a data-app bundle by name and supervises it: fetches the bundle code,
 * instantiates it inside the Near-Membrane sandbox, and watches for uncaught
 * crashes. Any failure is reported up to the host `AppView` (which owns the
 * themed failure screen); the returned `failed` flag only gates what the iframe
 * renders in the meantime (the bundle vs. a neutral loader).
 */
export const useDataAppBundle = (
  name: string,
  { embedded = false }: { embedded?: boolean } = {},
): {
  data: LoadedApp | null;
  failed: boolean;
  error?: string | null;
} => {
  const [data, setData] = useState<LoadedApp | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setData(null);
    setFailed(false);
    setError(null);

    const load = async () => {
      const { code, allowedHosts, contentSecurityPolicy } =
        await fetchDataAppBundleCode(name, { embedded });

      if (cancelled) {
        return;
      }

      // Embedded data apps needs to set the CSP via meta tag on the frontend.
      // CSP contains allowed hosts which we don't want to expose without auth,
      // so we do client-side auth first, then fetch and inject the CSP policy.
      if (embedded) {
        insertContentSecurityPolicyMetaTag(contentSecurityPolicy);
      }

      const { component, providerProps } = await instantiateDataAppBundle(
        code,
        name,
        window,
        allowedHosts,
        { embedded },
      );

      if (cancelled) {
        return;
      }

      setData({ component, providerProps });
    };

    load().catch((error: unknown) => {
      if (!cancelled) {
        const notReady =
          error instanceof DataAppBundleError && error.status === 404;
        // A 404 (not-yet-synced) is expected, so we keep the friendly message;
        // any other failure carries the real error so it can be shown.
        const detail = notReady ? undefined : describeError(error);
        setFailed(true);

        if (embedded) {
          // Embedded data apps shows their own error screen
          setError(describeError(error).message);
        } else {
          // Internal data apps reports the error to the parent
          reportErrorToParent(notReady, detail);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name, embedded]);

  useEffect(() => {
    // The bundle runs in a Near-Membrane sandbox that can throw errors which
    // escape React's render cycle (e.g. an opaque `#<Object>` from the membrane)
    // and so slip past `BundleErrorBoundary`, leaving a blank frame. Catch
    // genuine uncaught JS errors at the window level and show the error screen.
    // `event.error == null` for resource-load errors, which we ignore.
    const onError = (event: ErrorEvent) => {
      if (event.error != null) {
        const detail = describeError(event.error, event.message);
        // Log the unpacked message/stack so devtools shows the real error
        // instead of the membrane's opaque `#<Object>`.
        console.error(
          "[data-app] uncaught error in the bundle:",
          detail.message,
          detail.stack ?? "",
        );
        setFailed(true);

        if (embedded) {
          setError(detail.message);
        } else {
          reportErrorToParent(false, detail);
        }
      }
    };

    window.addEventListener("error", onError);

    return () => window.removeEventListener("error", onError);
  }, [embedded]);

  return { data, failed, error };
};
