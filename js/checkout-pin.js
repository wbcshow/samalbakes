/* Checkout location is always confirmed by the customer; old area checks cannot override it. */
(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  SB.initCheckoutPin = function (delivery, onChange) {
    var state = SB.checkoutPin = { confirmed: false };
    var status = document.getElementById("checkout-pin-status");
    var confirm = document.getElementById("checkout-confirm");
    if (typeof L === "undefined") {
      status.textContent = "The map could not load. Reload this page or contact us for help placing your order.";
      onChange(state);
      return;
    }
    var map = L.map("checkout-map").setView([delivery.center.lat, delivery.center.lng], 13);
    var tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>', maxZoom: 19
    }).addTo(map);
    tiles.on("tileerror", function () { status.textContent = "Some map tiles could not load. Check your connection before confirming the pin."; });
    L.circle([delivery.center.lat, delivery.center.lng], { radius: delivery.radiusKm * 1000, color: "#c45c26", fillOpacity: 0.08 }).addTo(map);
    var marker;
    var candidate;
    var revision = 0;
    var method = "search";
    function select(latlng) {
      revision++;
      candidate = { lat: latlng.lat, lng: ((latlng.lng + 180) % 360 + 360) % 360 - 180 };
      if (!marker) {
        marker = L.marker([candidate.lat, candidate.lng], { draggable: method !== "location", alt: "Your delivery pin" }).addTo(map);
        marker.on("dragstart", function () { if(method === "location")return; state.confirmed = false; confirm.disabled = true; onChange(state); });
        marker.on("dragend", function () { if(method !== "location")select(marker.getLatLng()); });
      } else marker.setLatLng([candidate.lat, candidate.lng]);
      state.confirmed = false;
      var distance = SB.delivery.haversineKm(delivery.center, candidate);
      state.distanceKm = distance;
      state.inZone = distance <= Number(delivery.radiusKm);
      confirm.disabled = !state.inZone;
      status.textContent = state.inZone ? "Pin selected. Adjust it to your entrance, then choose Deliver here." : "This pin is outside our delivery area. Move the pin or contact us about delivery.";
      onChange(state);
    }
    map.on("click", function (event) { if(method !== "location")select(event.latlng); });
    confirm.onclick = function () {
      if (!candidate || !state.inZone) return;
      state.lat = candidate.lat; state.lng = candidate.lng;
      state.url = "https://www.google.com/maps?q=" + state.lat.toFixed(6) + "," + state.lng.toFixed(6);
      state.confirmed = true;
      confirm.disabled = true;
      status.textContent = "Delivery pin confirmed. Move the pin to change your destination.";
      onChange(state);
    };
    var locate = document.getElementById("checkout-locate");
    var search = document.getElementById("checkout-search");
    var searchButton = document.getElementById("checkout-search-button");
    searchButton.onclick = function () {
      var query = search.value.trim();
      if (!query) { status.textContent = "Enter a place or landmark, or tap the map."; return; }
      var startedAt = revision;
      searchButton.disabled = true;
      status.textContent = "Finding that place…";
      SB.delivery.geocodeAddress(query + ", Philippines").then(function (point) {
        if (revision !== startedAt) return;
        if (!point) { status.textContent = "Place not found. Try another landmark or tap the map."; return; }
        map.setView([point.lat, point.lng], 16);
        select(point);
      }).catch(function () {
        if (revision === startedAt) status.textContent = "Place search is unavailable. Zoom and tap the map instead.";
      }).finally(function () { searchButton.disabled = false; });
    };
    search.onkeydown = function (event) { if (event.key === "Enter") { event.preventDefault(); if (!searchButton.disabled) searchButton.onclick(); } };
    locate.onclick = function () {
      revision++;
      if(method === "location"){state.confirmed=false;confirm.disabled=true;onChange(state);}
      locate.hidden=true;
      function failed(text){status.textContent=text;locate.hidden=false;locate.textContent="Try location again";}
      if (!navigator.geolocation) { failed("Device location is unavailable. Use Search address or Place a pin instead."); return; }
      var startedAt = revision;
      locate.disabled = true;
      status.textContent = "Finding your location…";
      navigator.geolocation.getCurrentPosition(function (position) {
        locate.disabled = false;
        if (revision !== startedAt) return;
        var point = { lat: position.coords.latitude, lng: position.coords.longitude };
        map.setView([point.lat, point.lng], 17);
        select(point);
        if(method === "location"){
          if(state.inZone){confirm.onclick();status.textContent="Current location confirmed. Continue to contact details.";}
          else status.textContent="Your current location is outside our delivery area. Use another tab if delivery is to a different location.";
        }
      }, function () {
        locate.disabled = false;
        if (revision === startedAt) failed("Could not get your location. Allow location access and retry, or use another tab.");
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    };
    state.resize = function () { map.invalidateSize(); };
    state.cancelLookup = function () {
      revision++;
      status.textContent = state.confirmed ? "Delivery pin confirmed. Move the pin to change your destination." : candidate ? (state.inZone ? "Pin selected. Adjust it to your entrance, then choose Deliver here." : "This pin is outside our delivery area. Move the pin or contact us about delivery.") : "Choose your delivery pin to continue.";
    };
    state.setMethod = function (next) {
      state.cancelLookup();method=next;
      if(marker&&marker.dragging){if(method === "location")marker.dragging.disable();else marker.dragging.enable();}
      locate.hidden=true;
      if(method === "location")locate.onclick();
    };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(state.resize).observe(document.getElementById("checkout-map"));
    onChange(state);
  };
})();
