/* eslint-disable testing-library/no-node-access -- CSP metadata lives outside the rendered React tree. */
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  DataAppBundleError,
  fetchDataAppBundleCode,
  instantiateDataAppBundle,
} from "../loader";
import { useDataAppBundle } from "./use-data-app-bundle";

jest.mock("../loader", () => ({
  ...jest.requireActual("../loader"),
  fetchDataAppBundleCode: jest.fn(),
  instantiateDataAppBundle: jest.fn(),
}));

const policy =
  "default-src 'none'; connect-src 'self' https://api.example.com; form-action 'none'; frame-ancestors *;";
const bundle = {
  code: "BUNDLE",
  allowedHosts: [],
  contentSecurityPolicy: policy,
};

describe("embedded data app bundle loading", () => {
  const component = () => null;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(fetchDataAppBundleCode).mockResolvedValue(bundle);
    jest
      .mocked(instantiateDataAppBundle)
      .mockResolvedValue({ component, providerProps: {} });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document
      .querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
      .forEach((meta) => meta.remove());
  });

  it("installs bundle policy before creating the sandbox and evaluating source", async () => {
    jest.mocked(instantiateDataAppBundle).mockImplementation(async () => {
      expect(
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute("content"),
      ).toBe(
        "default-src 'none'; connect-src 'self' https://api.example.com; form-action 'none';",
      );
      return { component, providerProps: {} };
    });

    const { result } = renderHook(() =>
      useDataAppBundle("sales", { embedded: true }),
    );

    await waitFor(() => expect(result.current.data?.component).toBe(component));
    expect(fetchDataAppBundleCode).toHaveBeenCalledTimes(1);
    expect(fetchDataAppBundleCode).toHaveBeenCalledWith("sales", {
      embedded: true,
    });
    expect(instantiateDataAppBundle).toHaveBeenCalledWith(
      "BUNDLE",
      "sales",
      window,
      [],
      { embedded: true },
    );
  });

  it.each([null, undefined, "", " "])(
    "does not evaluate without a policy: %p",
    async (contentSecurityPolicy) => {
      jest
        .mocked(fetchDataAppBundleCode)
        .mockResolvedValue({ ...bundle, contentSecurityPolicy });
      const { result } = renderHook(() =>
        useDataAppBundle("sales", { embedded: true }),
      );

      await waitFor(() => expect(result.current.failed).toBe(true));
      expect(result.current.error).toBe(
        "The authenticated data app policy is missing.",
      );
      expect(instantiateDataAppBundle).not.toHaveBeenCalled();
    },
  );

  it.each([403, 404, 409])(
    "does not evaluate a rejected bundle: %s",
    async (status) => {
      jest
        .mocked(fetchDataAppBundleCode)
        .mockRejectedValue(
          new DataAppBundleError("Bundle unavailable", status),
        );
      const { result } = renderHook(() =>
        useDataAppBundle("sales", { embedded: true }),
      );

      await waitFor(() => expect(result.current.failed).toBe(true));
      expect(result.current.error).toBe("Bundle unavailable");
      expect(instantiateDataAppBundle).not.toHaveBeenCalled();
    },
  );

  it("discards the bundle and policy when unmounted during the fetch", async () => {
    let completeFetch = (_value: typeof bundle) => {};
    jest.mocked(fetchDataAppBundleCode).mockReturnValue(
      new Promise((resolve) => {
        completeFetch = resolve;
      }),
    );
    const { unmount } = renderHook(() =>
      useDataAppBundle("sales", { embedded: true }),
    );
    unmount();

    await act(async () => {
      completeFetch(bundle);
    });

    expect(
      document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
    ).toBeNull();
    expect(instantiateDataAppBundle).not.toHaveBeenCalled();
  });
});
