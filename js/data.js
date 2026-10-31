/**
 * SamalBakes data layer — Demo (localStorage) or Supabase.
 * Public API: SB.data.*
 */
(function () {
  "use strict";
  var SB = (window.SAMALBAKES = window.SAMALBAKES || {});
  var DEMO_ADMIN_EMAIL = "admin@demo.local";
  var DEMO_ADMIN_PASS = "demo-admin-2026";
  var LS = {
    users: "sb_demo_users",
    session: "sb_demo_session",
    products: "sb_demo_products",
    settings: "sb_demo_settings",
    orders: "sb_demo_orders",
  };

  function uid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function cleanProfile(fields) {
    fields = fields || {};
    return {
      full_name: String(fields.full_name == null ? "" : fields.full_name).trim(),
      phone: String(fields.phone == null ? "" : fields.phone).trim(),
      delivery_address: String(fields.delivery_address == null ? "" : fields.delivery_address).trim(),
    };
  }

  function assertNewPassword(pw) {
    if (pw == null || String(pw).length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
  }

  function defaultSettings() {
    var c = SB.config || {};
    var d = c.delivery || {};
    var p = c.production || {};
    return {
      delivery_center_lat: (d.center && d.center.lat) || 7.128,
      delivery_center_lng: (d.center && d.center.lng) || 125.693,
      delivery_radius_km: d.radiusKm != null ? d.radiusKm : 25,
      delivery_fee_type: "flat",
      delivery_fee_flat: 80,
      delivery_fee_per_km: 15,
      free_delivery_min_order: d.freeDeliveryMinOrder != null ? d.freeDeliveryMinOrder : 1500,
      packing_buffer_minutes: p.packingBufferMinutes || 15,
      delivery_buffer_minutes: p.deliveryBufferMinutes || 30,
      oven_batch_slots: p.ovenBatchSlots || 12,
      allow_mixed_batches: p.allowMixedBatches !== false,
      global_min_lead_minutes: p.globalMinLeadMinutes || 60,
      working_hours: c.workingHours || {},
      featured_product_ids: c.featuredProductIds || null,
      promotions: SB.promos || [],
      contact: c.contact || {},
    };
  }

  function seedProductsFromStatic() {
    return (SB.products || []).map(function (p, i) {
      return {
        id: p.id,
        name: p.name,
        description: p.description || "",
        price: Number(p.price),
        bake_time_minutes: p.bakeTimeMinutes || 30,
        prep_minutes: p.prepMinutes || 0,
        min_lead_minutes: p.minLeadMinutes || 60,
        slots: p.slots || 1,
        category: p.category || "Breads",
        wholesale_note: p.wholesaleNote || "",
        image_url: p.image || p.image_url || "",
        active: p.active !== false,
        example: !!p.example,
        photo_real: !!p.photoReal,
        sort_order: i + 1,
      };
    });
  }

  function ensureDemoSeed() {
    var SEED_VER = "cakes-photos-v1";
    if (lsGet("sb_demo_seed_ver", null) !== SEED_VER) {
      lsSet(LS.products, seedProductsFromStatic());
      lsSet("sb_demo_seed_ver", SEED_VER);
    }
    if (!lsGet(LS.products, null)) lsSet(LS.products, seedProductsFromStatic());
    if (!lsGet(LS.settings, null)) lsSet(LS.settings, defaultSettings());
    if (!lsGet(LS.orders, null)) lsSet(LS.orders, []);
    var users = lsGet(LS.users, []);
    if (!users.some(function (u) { return u.email === DEMO_ADMIN_EMAIL; })) {
      users.push({
        id: "demo-admin-id",
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASS,
        full_name: "Demo Admin",
        phone: "",
        delivery_address: "",
        is_admin: true,
      });
      lsSet(LS.users, users);
    }
  }

  function mapProductRow(r) {
    var img = r.image_url || r.image || "";
    return {
      id: r.id,
      name: r.name,
      description: r.description || "",
      price: Number(r.price),
      bakeTimeMinutes: r.bake_time_minutes != null ? r.bake_time_minutes : r.bakeTimeMinutes,
      prepMinutes: r.prep_minutes != null ? r.prep_minutes : r.prepMinutes || 0,
      minLeadMinutes: r.min_lead_minutes != null ? r.min_lead_minutes : r.minLeadMinutes || 60,
      slots: r.slots || 1,
      category: r.category || "Breads",
      wholesaleNote: r.wholesale_note || r.wholesaleNote || "",
      image: img,
      image_url: img,
      active: r.active !== false,
      example: !!r.example,
      photoReal: !!(r.photo_real != null ? r.photo_real : r.photoReal),
      photo_real: !!(r.photo_real != null ? r.photo_real : r.photoReal),
      sort_order: r.sort_order || 0,
      bake_time_minutes: r.bake_time_minutes != null ? r.bake_time_minutes : r.bakeTimeMinutes,
      prep_minutes: r.prep_minutes != null ? r.prep_minutes : r.prepMinutes || 0,
      min_lead_minutes: r.min_lead_minutes != null ? r.min_lead_minutes : r.minLeadMinutes || 60,
      wholesale_note: r.wholesale_note || r.wholesaleNote || "",
    };
  }

  function applySettingsToConfig(s) {
    if (s.promotions) SB.promos = s.promotions;
    if (!SB.config) SB.config = {};
    SB.config.delivery = SB.config.delivery || {};
    SB.config.delivery.center = {
      lat: Number(s.delivery_center_lat),
      lng: Number(s.delivery_center_lng),
    };
    SB.config.delivery.radiusKm = Number(s.delivery_radius_km);
    SB.config.delivery.freeDeliveryMinOrder = Number(s.free_delivery_min_order);
    SB.config.delivery.feeType = s.delivery_fee_type;
    SB.config.delivery.feeFlat = Number(s.delivery_fee_flat);
    SB.config.delivery.feePerKm = Number(s.delivery_fee_per_km);
    SB.config.production = SB.config.production || {};
    SB.config.production.packingBufferMinutes = Number(s.packing_buffer_minutes);
    SB.config.production.deliveryBufferMinutes = Number(s.delivery_buffer_minutes);
    SB.config.production.ovenBatchSlots = Number(s.oven_batch_slots);
    SB.config.production.allowMixedBatches = !!s.allow_mixed_batches;
    SB.config.production.globalMinLeadMinutes = Number(s.global_min_lead_minutes);
    if (s.working_hours) {
      // JSON keys may be strings
      var wh = {};
      Object.keys(s.working_hours).forEach(function (k) {
        wh[Number(k)] = s.working_hours[k];
      });
      SB.config.workingHours = wh;
    }
    SB.config.featuredProductIds = s.featured_product_ids || null;
    if (s.contact && Object.keys(s.contact).length) {
      SB.config.contact = Object.assign({}, SB.config.contact || {}, s.contact);
    }
  }

  function calcDeliveryFee(settings, subtotalAfterDiscount, distanceKm) {
    if (subtotalAfterDiscount >= Number(settings.free_delivery_min_order)) return 0;
    var dist = distanceKm != null ? Number(distanceKm) : 0;
    if (settings.delivery_fee_type === "per_km") {
      return Math.round(dist * Number(settings.delivery_fee_per_km) * 100) / 100;
    }
    if (settings.delivery_fee_type === "flat_plus_per_km") {
      return (
        Math.round(
          (Number(settings.delivery_fee_flat) + dist * Number(settings.delivery_fee_per_km)) * 100
        ) / 100
      );
    }
    return Number(settings.delivery_fee_flat) || 0;
  }

  function calcDiscount(subtotal, promoCode) {
    var code = (promoCode || "").trim().toUpperCase();
    var p=(SB.promos||[]).find(function(p){return p.code&&p.code.toUpperCase()===code&&SB.promotionRules.available(p);});
    if(!p||subtotal<Number(p.minSubtotal||0))return 0;
    return Math.min(subtotal,Math.round((p.type==='percent'?subtotal*Number(p.percentOff)/100:p.type==='fixed'?Number(p.amountOff):0)*100)/100);
  }

  /* ---------- Demo backend ---------- */
  var demo = {
    async init() {
      ensureDemoSeed();
      return true;
    },
    async getSession() {
      var s = lsGet(LS.session, null);
      if (!s) return null;
      var users = lsGet(LS.users, []);
      var u = users.find(function (x) { return x.id === s.userId; });
      if (!u) return null;
      return {
        user: {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone: u.phone || "",
          delivery_address: u.delivery_address || "",
          is_admin: !!u.is_admin,
        },
      };
    },
    async register(email, password, fullName) {
      email = String(email || "").trim().toLowerCase();
      var users = lsGet(LS.users, []);
      if (users.some(function (u) { return u.email === email; })) {
        throw new Error("An account with that email already exists.");
      }
      var u = {
        id: uid(),
        email: email,
        password: String(password),
        full_name: fullName || "",
        phone: "",
        delivery_address: "",
        is_admin: false,
      };
      users.push(u);
      lsSet(LS.users, users);
      lsSet(LS.session, { userId: u.id });
      return demo.getSession();
    },
    async login(email, password) {
      email = String(email || "").trim().toLowerCase();
      var users = lsGet(LS.users, []);
      var u = users.find(function (x) {
        return x.email === email && x.password === String(password);
      });
      if (!u) throw new Error("Invalid email or password.");
      lsSet(LS.session, { userId: u.id });
      return demo.getSession();
    },
    async logout() {
      localStorage.removeItem(LS.session);
    },
    async updateProfile(fields) {
      var session = await demo.getSession();
      if (!session) throw new Error("Log in to update your account.");
      var clean = cleanProfile(fields);
      var users = lsGet(LS.users, []);
      var u = users.find(function (x) { return x.id === session.user.id; });
      if (!u) throw new Error("Account not found.");
      u.full_name = clean.full_name;
      u.phone = clean.phone;
      u.delivery_address = clean.delivery_address;
      lsSet(LS.users, users);
      return demo.getSession();
    },
    async changePassword(currentPassword, newPassword) {
      assertNewPassword(newPassword);
      var session = await demo.getSession();
      if (!session) throw new Error("Log in to change your password.");
      var users = lsGet(LS.users, []);
      var u = users.find(function (x) { return x.id === session.user.id; });
      if (!u || u.password !== String(currentPassword)) {
        throw new Error("Current password is incorrect.");
      }
      u.password = String(newPassword);
      lsSet(LS.users, users);
      return true;
    },
    async getProducts(includeInactive) {
      var list = lsGet(LS.products, seedProductsFromStatic()).map(mapProductRow);
      if (!includeInactive) list = list.filter(function (p) { return p.active; });
      return list.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    },
    async saveProduct(prod) {
      var list = lsGet(LS.products, []);
      var idx = list.findIndex(function (p) { return p.id === prod.id; });
      var row = {
        id: prod.id,
        name: prod.name,
        description: prod.description || "",
        price: Number(prod.price),
        bake_time_minutes: Number(prod.bake_time_minutes || prod.bakeTimeMinutes || 30),
        prep_minutes: Number(prod.prep_minutes || prod.prepMinutes || 0),
        min_lead_minutes: Number(prod.min_lead_minutes || prod.minLeadMinutes || 60),
        slots: Number(prod.slots || 1),
        category: prod.category || "Breads",
        wholesale_note: prod.wholesale_note || prod.wholesaleNote || "",
        image_url: prod.image_url || prod.image || "",
        active: prod.active !== false,
        example: !!prod.example,
        photo_real: !!(prod.photo_real != null ? prod.photo_real : prod.photoReal),
        sort_order: Number(prod.sort_order || 0),
      };
      if (idx >= 0) list[idx] = row;
      else list.push(row);
      lsSet(LS.products, list);
      return mapProductRow(row);
    },
    async deleteProduct(id) {
      var list = lsGet(LS.products, []);
      var next = list.filter(function (p) { return p.id !== id; });
      if (next.length === list.length) throw new Error("Product not found.");
      lsSet(LS.products, next);
      return true;
    },
    async getSettings() {
      return lsGet(LS.settings, defaultSettings());
    },
    async saveSettings(partial) {
      var cur = lsGet(LS.settings, defaultSettings());
      var next = Object.assign({}, cur, partial);
      lsSet(LS.settings, next);
      applySettingsToConfig(next);
      return next;
    },
    async placeOrder(payload) {
      var products = await demo.getProducts(false);
      var settings = await demo.getSettings();
      var byId = {};
      products.forEach(function (p) { byId[p.id] = p; });
      var items = [];
      var subtotal = 0;
      (payload.items || []).forEach(function (line) {
        var p = byId[line.product_id];
        if (!p) throw new Error("Unknown product: " + line.product_id);
        var qty = Number(line.qty) || 0;
        if (qty < 1) throw new Error("Invalid qty");
        var unit = Number(p.price);
        var lineTotal = Math.round(unit * qty * 100) / 100;
        subtotal += lineTotal;
        items.push({
          id: uid(),
          product_id: p.id,
          product_name: p.name,
          unit_price: unit,
          qty: qty,
          line_total: lineTotal,
          bake_time_minutes: p.bakeTimeMinutes,
          slots: p.slots,
        });
      });
      if (!items.length) throw new Error("Cart is empty");
      var checkedRadius = Number(settings.delivery_radius_km);
      var checkedDist = payload.distance_km != null && payload.distance_km !== "" ? Number(payload.distance_km) : null;
      if (checkedDist != null && !isNaN(checkedDist) && checkedDist > checkedRadius) {
        throw new Error("That location is outside our delivery area.");
      }
      var session = await demo.getSession();
      var orders = lsGet(LS.orders, []);
      if (String(payload.promo_code || "").trim().toUpperCase() === "SAMALWELCOME") {
        var email = String(payload.guest_email || "").trim().toLowerCase();
        var accountEmail = session ? String(session.user.email || "").trim().toLowerCase() : "";
        function phone(value) {
          var digits = String(value || "").replace(/[^0-9]/g, "");
          if (/^09[0-9]{9}$/.test(digits)) return "63" + digits.slice(1);
          if (/^9[0-9]{9}$/.test(digits)) return "63" + digits;
          if (/^00639[0-9]{9}$/.test(digits)) return digits.slice(2);
          return digits;
        }
        var customerPhone = phone(payload.guest_phone);
        if (!session && !email && !customerPhone) {
          throw new Error("Enter an email or phone number to use SAMALWELCOME on your first order.");
        }
        var previous = orders.some(function (o) {
          var priorEmail = String(o.guest_email || "").trim().toLowerCase();
          return (session && o.user_id === session.user.id) ||
            (email && priorEmail === email) || (accountEmail && priorEmail === accountEmail) ||
            (customerPhone && phone(o.guest_phone) === customerPhone);
        });
        if (previous) {
          throw new Error("SAMALWELCOME is for first orders only, one per customer. Please remove the code to continue.");
        }
      }
      var requestedCode=String(payload.promo_code||'').trim().toUpperCase();
      var offer=(SB.promos||[]).find(function(p){return p.code===requestedCode;});
      if(requestedCode&&(!offer||!SB.promotionRules.available(offer)||offer.type==='info'||subtotal<Number(offer.minSubtotal||0)))throw new Error('This promotion is unavailable or its minimum order has not been met.');
      var discount = calcDiscount(subtotal, payload.promo_code);
      var after = Math.max(0, subtotal - discount);
      var deliveryFee = calcDeliveryFee(settings, after, payload.distance_km);
      if(offer&&offer.type==='free_delivery')deliveryFee=0;
      var order = {
        id: uid(),
        user_id: session ? session.user.id : null,
        guest_name: payload.guest_name || null,
        guest_email: payload.guest_email || null,
        guest_phone: payload.guest_phone || null,
        status: "new",
        subtotal: subtotal,
        discount: discount,
        delivery_fee: deliveryFee,
        total: after + deliveryFee,
        payment_method: "cod",
        promo_code: (payload.promo_code || "").trim() || null,
        estimated_ready_at: payload.estimated_ready_at || null,
        estimated_delivery_at: payload.estimated_delivery_at || null,
        delivery_address: payload.delivery_address || null,
        notes: payload.notes || null,
        distance_km: payload.distance_km != null ? payload.distance_km : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: items,
      };
      orders.unshift(order);
      lsSet(LS.orders, orders);
      return order;
    },
    async getMyOrders() {
      var session = await demo.getSession();
      if (!session) return [];
      return lsGet(LS.orders, []).filter(function (o) {
        return o.user_id === session.user.id;
      });
    },
    async getAllOrders() {
      return lsGet(LS.orders, []);
    },
    async updateOrderStatus(orderId, status) {
      var allowed = ["new", "baking", "ready", "out_for_delivery", "delivered", "cancelled"];
      if (allowed.indexOf(status) < 0) throw new Error("Invalid status");
      var orders = lsGet(LS.orders, []);
      var o = orders.find(function (x) { return x.id === orderId; });
      if (!o) throw new Error("Order not found");
      o.status = status;
      o.updated_at = new Date().toISOString();
      lsSet(LS.orders, orders);
      return o;
    },
  };

  /* ---------- Supabase backend ---------- */
  var remote = {
    client: null,
    async init() {
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error("supabase-js not loaded");
      }
      var cfg = SB.supabaseConfig;
      remote.client = window.supabase.createClient(cfg.url, cfg.anonKey);
      return true;
    },
    async getSession() {
      var res = await remote.client.auth.getSession();
      var session = res.data && res.data.session;
      if (!session) return null;
      var profile = await remote.client
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      var p = profile.data || {};
      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          full_name: p.full_name || "",
          phone: p.phone || "",
          delivery_address: p.delivery_address || "",
          is_admin: !!p.is_admin,
        },
      };
    },
    async register(email, password, fullName) {
      var res = await remote.client.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: fullName || "" } },
      });
      if (res.error) throw new Error(res.error.message);
      var session = await remote.getSession();
      if (session) return session;
      var pending = new Error(
        "Account created. Check your email to confirm it, then log in."
      );
      pending.code = "email_confirmation_required";
      throw pending;
    },
    async login(email, password) {
      var res = await remote.client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw new Error(res.error.message);
      return remote.getSession();
    },
    async logout() {
      await remote.client.auth.signOut();
    },
    async updateProfile(fields) {
      var session = await remote.getSession();
      if (!session) throw new Error("Log in to update your account.");
      var clean = cleanProfile(fields);
      var base = { full_name: clean.full_name, phone: clean.phone };
      var res = await remote.client
        .from("profiles")
        .update(Object.assign({ delivery_address: clean.delivery_address }, base))
        .eq("id", session.user.id)
        .select()
        .maybeSingle();
      if (res.error && /delivery_address/i.test(res.error.message || "")) {
        var retry = await remote.client
          .from("profiles")
          .update(base)
          .eq("id", session.user.id)
          .select()
          .maybeSingle();
        if (retry.error) throw new Error(retry.error.message);
        if (!retry.data) throw new Error("Couldn't update your profile.");
        throw new Error(
          "Name and phone were saved, but delivery address is not in the database yet. Run supabase/profile-delivery-address.sql in the Supabase SQL editor."
        );
      }
      if (res.error) throw new Error(res.error.message);
      if (!res.data) throw new Error("Couldn't update your profile.");
      return remote.getSession();
    },
    async changePassword(currentPassword, newPassword) {
      assertNewPassword(newPassword);
      var session = await remote.getSession();
      if (!session) throw new Error("Log in to change your password.");
      var check = await remote.client.auth.signInWithPassword({
        email: session.user.email,
        password: String(currentPassword),
      });
      if (check.error) {
        var message = check.error.message || "";
        if (/invalid|credential|password/i.test(message)) {
          throw new Error("Current password is incorrect.");
        }
        throw new Error(message);
      }
      var updated = await remote.client.auth.updateUser({ password: String(newPassword) });
      if (updated.error) throw new Error(updated.error.message);
      return true;
    },
    async getProducts(includeInactive) {
      var q = remote.client.from("products").select("*").order("sort_order");
      if (!includeInactive) q = q.eq("active", true);
      var res = await q;
      if (res.error) throw new Error(res.error.message);
      return (res.data || []).map(mapProductRow);
    },
    async saveProduct(prod) {
      var row = {
        id: prod.id,
        name: prod.name,
        description: prod.description || "",
        price: Number(prod.price),
        bake_time_minutes: Number(prod.bake_time_minutes || prod.bakeTimeMinutes || 30),
        prep_minutes: Number(prod.prep_minutes || prod.prepMinutes || 0),
        min_lead_minutes: Number(prod.min_lead_minutes || prod.minLeadMinutes || 60),
        slots: Number(prod.slots || 1),
        category: prod.category || "Breads",
        wholesale_note: prod.wholesale_note || "",
        image_url: prod.image_url || prod.image || "",
        active: prod.active !== false,
        example: !!prod.example,
        photo_real: !!(prod.photo_real != null ? prod.photo_real : prod.photoReal),
        sort_order: Number(prod.sort_order || 0),
        updated_at: new Date().toISOString(),
      };
      var res = await remote.client.from("products").upsert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return mapProductRow(res.data);
    },
    async uploadProductPhoto(file) {
      var extension = SB.productPhoto.validate(file);
      var session = await remote.getSession();
      if (!session || !session.user.is_admin) throw new Error("Log in as an admin to upload a photo.");
      var storage = remote.client.storage.from("product-photos");
      var objectPath = session.user.id + "/" + uid() + "." + extension;
      var res = await storage.upload(objectPath, file, { contentType: file.type, upsert: false });
      if (res.error) throw new Error("Photo upload failed. " + res.error.message);
      var url = storage.getPublicUrl(objectPath);
      if (!url.data || !url.data.publicUrl) throw new Error("Could not get the uploaded photo address.");
      return url.data.publicUrl;
    },
    async deleteProduct(id) {
      var res = await remote.client.from("products").delete().eq("id", id).select("id");
      if (res.error) throw new Error(res.error.message);
      if (!res.data || !res.data.length) throw new Error("Couldn't delete that product.");
      return true;
    },
    async getSettings() {
      var res = await remote.client.from("settings").select("*").eq("id", 1).single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    async saveSettings(partial) {
      var payload = Object.assign({}, partial, { id: 1, updated_at: new Date().toISOString() });
      var res = await remote.client.from("settings").update(payload).eq("id", 1).select().maybeSingle();
      if (res.error) throw new Error(res.error.message);
      if (!res.data) throw new Error("Settings could not be saved. Make sure you are logged in as an admin, then try again.");
      applySettingsToConfig(res.data);
      return res.data;
    },
    async placeOrder(payload) {
      var liveSettings = await remote.getSettings();
      var liveRadius = Number(liveSettings.delivery_radius_km);
      var liveDist = payload.distance_km != null && payload.distance_km !== "" ? Number(payload.distance_km) : null;
      if (liveDist != null && !isNaN(liveDist) && liveDist > liveRadius) {
        throw new Error("That location is outside our delivery area.");
      }
      var res = await remote.client.rpc("place_order", {
        p_items: (payload.items || []).map(function (i) {
          return { product_id: i.product_id, qty: i.qty };
        }),
        p_promo_code: payload.promo_code || null,
        p_guest_name: payload.guest_name || null,
        p_guest_email: payload.guest_email || null,
        p_guest_phone: payload.guest_phone || null,
        p_delivery_address: payload.delivery_address || null,
        p_notes: payload.notes || null,
        p_distance_km: payload.distance_km != null ? payload.distance_km : null,
        p_estimated_ready_at: payload.estimated_ready_at || null,
        p_estimated_delivery_at: payload.estimated_delivery_at || null,
      });
      if (res.error) throw new Error(res.error.message);
      var orderId = res.data;
      var ord = await remote.client.from("orders").select("*").eq("id", orderId).single();
      var items = await remote.client.from("order_items").select("*").eq("order_id", orderId);
      var order = ord.data || { id: orderId };
      order.items = items.data || [];
      return order;
    },
    async getMyOrders() {
      var session = await remote.getSession();
      if (!session) return [];
      var res = await remote.client
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      return (res.data || []).map(function (o) {
        o.items = o.order_items || [];
        return o;
      });
    },
    async getAllOrders() {
      var res = await remote.client
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      return (res.data || []).map(function (o) {
        o.items = o.order_items || [];
        return o;
      });
    },
    async updateOrderStatus(orderId, status) {
      var res = await remote.client
        .from("orders")
        .update({ status: status, updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  };

  var api = {
    demoCredentials: { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASS },
    isDemo: false,
    backend: null,
    calcDeliveryFee: calcDeliveryFee,
    calcDiscount: calcDiscount,

    async init() {
      api.isDemo = typeof SB.isDemoMode === "function" ? SB.isDemoMode() : true;
      api.backend = api.isDemo ? demo : remote;
      await api.backend.init();
      var settings = await api.getSettings();
      applySettingsToConfig(settings);
      var products = await api.getProducts(false);
      SB.products = products;
      return { demo: api.isDemo, settings: settings, products: products };
    },
    getSession: function () { return api.backend.getSession(); },
    register: function (e, p, n) { return api.backend.register(e, p, n); },
    login: function (e, p) { return api.backend.login(e, p); },
    logout: function () { return api.backend.logout(); },
    updateProfile: function (fields) { return api.backend.updateProfile(fields); },
    changePassword: function (currentPassword, newPassword) {
      return api.backend.changePassword(currentPassword, newPassword);
    },
    getProducts: function (inc) { return api.backend.getProducts(inc); },
    saveProduct: function (p) { return api.backend.saveProduct(p); },
    uploadProductPhoto: function (file) {
      if (api.isDemo) return Promise.reject(new Error("Photo uploads use the live site."));
      return api.backend.uploadProductPhoto(file);
    },
    deleteProduct: function (id) { return api.backend.deleteProduct(id); },
    getSettings: function () { return api.backend.getSettings(); },
    saveSettings: function (p) { return api.backend.saveSettings(p); },
    placeOrder: function (p) { return api.backend.placeOrder(p); },
    getMyOrders: function () { return api.backend.getMyOrders(); },
    getAllOrders: function () { return api.backend.getAllOrders(); },
    updateOrderStatus: function (id, s) { return api.backend.updateOrderStatus(id, s); },
    applySettingsToConfig: applySettingsToConfig,
  };

  SB.data = api;
})();
