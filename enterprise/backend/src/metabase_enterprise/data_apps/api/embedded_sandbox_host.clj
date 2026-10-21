(ns metabase-enterprise.data-apps.api.embedded-sandbox-host
  "Near-membrane evaluator for embedded data apps."
  (:require
   [metabase.api.macros :as api.macros]
   [metabase.embedding.settings :as embedding]))

(api.macros/defendpoint :get "/embedded-sandbox-host" :- :any
  "Serve an empty evaluator realm without session cookies."
  []
  (if-not (embedding/enable-embedding-modular)
    {:status 403 :body "Modular embedding is disabled."}
    {:status 200
     :headers {"Content-Type" "text/html; charset=utf-8"
               "Content-Security-Policy" "default-src 'none'; script-src 'unsafe-eval'; form-action 'none'; frame-ancestors *;"
               "X-Frame-Options" nil
               "Referrer-Policy" "no-referrer"
               "Cache-Control" "no-store"}
     :body "<!doctype html><html><head></head><body></body></html>"}))

(def routes
  "Unauthenticated near-membrane evaluator route."
  (api.macros/ns-handler *ns*))
