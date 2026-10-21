(ns metabase-enterprise.data-apps.api.embedded-sandbox-host-test
  (:require
   [clojure.string :as str]
   [clojure.test :refer :all]
   [metabase.test :as mt]
   [metabase.test.http-client :as client]))

(deftest embedded-sandbox-host-does-not-require-authentication-test
  (mt/test-helpers-set-global-values!
    (mt/with-premium-features #{:data-apps :embedding-simple}
      (mt/with-temporary-setting-values [enable-embedding-modular true]
        (let [response (client/client-real-response :get 200 "apps/embedded-sandbox-host")
              headers (:headers response)]
          (is (= "<!doctype html><html><head></head><body></body></html>" (:body response)))
          (is (str/starts-with? (get headers "Content-Type") "text/html"))
          (is (= "default-src 'none'; script-src 'unsafe-eval'; form-action 'none'; frame-ancestors *;"
                 (get headers "Content-Security-Policy")))
          (is (nil? (get headers "X-Frame-Options")))
          (is (= "no-store" (get headers "Cache-Control")))
          (is (= "no-referrer" (get headers "Referrer-Policy"))))))))

(deftest embedded-sandbox-host-requires-modular-embedding-test
  (mt/with-premium-features #{:data-apps :embedding-simple}
    (mt/with-temporary-setting-values [enable-embedding-modular false]
      (client/client-full-response :get 403 "apps/embedded-sandbox-host")))
  ; disable embedded sandbox host when feature tokens are missing
  (mt/with-premium-features #{}
    (mt/with-temporary-setting-values [enable-embedding-modular true]
      (client/client-full-response :get 402 "apps/embedded-sandbox-host"))))
