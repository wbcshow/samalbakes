/**
 * Delivery-area checker: haversine radius + named areas + optional Nominatim geocode.
 */
(function () {
  "use strict";
  var SB = (window.SAMALBAKES = window.SAMALBAKES || {});

  function toRad(d) {
    return (d * Math.PI) / 180;
  }

  /** Distance in km between two lat/lng points. */
  function haversineKm(a, b) {
    var R = 6371;
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function pointInPolygon(lat, lng, ring) {
    // ray casting; ring is [[lng,lat], ...]
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0],
        yi = ring[i][1];
      var xj = ring[j][0],
        yj = ring[j][1];
      var intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function inDeliveryZone(lat, lng, delivery) {
    if (delivery.polygons && delivery.polygons.length) {
      for (var i = 0; i < delivery.polygons.length; i++) {
        if (pointInPolygon(lat, lng, delivery.polygons[i])) {
          return { inZone: true, method: "polygon", distanceKm: null };
        }
      }
    }
    var dist = haversineKm(delivery.center, { lat: lat, lng: lng });
    return {
      inZone: dist <= delivery.radiusKm,
      method: "radius",
      distanceKm: Math.round(dist * 10) / 10,
    };
  }

  /**
   * Geocode a free-text address via Nominatim (OpenStreetMap).
   * Please set a valid User-Agent via referrer; Nominatim usage policy applies.
   */
  function geocodeAddress(query) {
    // Nominatim often blocks file:// origins and may rate-limit; callers should fall back to the area dropdown.
    if (typeof location !== "undefined" && location.protocol === "file:") {
      return Promise.reject(
        new Error("Address lookup isn’t available right now. Please pick your area from the list.")
      );
    }
    var url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(query);
    return fetch(url, {
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        if (!r.ok) {
          var err = new Error("Geocoding failed (" + r.status + ")");
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then(function (results) {
        if (!results || !results.length) return null;
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          displayName: results[0].display_name,
        };
      });
  }

  function checkGeolocation(delivery) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var result = inDeliveryZone(lat, lng, delivery);
          result.lat = lat;
          result.lng = lng;
          resolve(result);
        },
        function (err) {
          reject(err);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  SB.delivery = {
    haversineKm: haversineKm,
    inDeliveryZone: inDeliveryZone,
    geocodeAddress: geocodeAddress,
    checkGeolocation: checkGeolocation,
  };
})();
