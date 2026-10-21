(ns metabase-enterprise.data-apps.core
  "What other modules may ask the data-apps module: what the files of an app's collection may hold."
  (:require
   [metabase-enterprise.data-apps.db :as data-apps.db]
   [metabase-enterprise.data-apps.resource-validation :as resource-validation]
   [metabase.api.common :as api]
   [metabase.models.interface :as mi]
   [metabase.premium-features.core :refer [defenterprise]]
   [potemkin :as p]))

(p/import-vars
 [resource-validation
  problems
  warnings])

(defenterprise check-data-app-access!
  "Checks that the user belongs to one of the assigned groups; superusers also reach disabled apps."
  :feature :data-apps
  [request]
  (let [app (data-apps.db/data-app-by-slug (get-in request [:route-params :name]))]
    (api/check-404 (and app (or (:enabled app) (:is-superuser? request))))
    (api/check-403 (mi/can-read? app))))
