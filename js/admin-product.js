(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  var LIST = "admin.html#products";
  var existing = null;
  var pendingPhoto = null;
  var previewUrl = null;
  var photoChanged = false;

  function releasePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function qs(s) { return document.querySelector(s); }
  function show(text, cls) {
    var el = qs("#product-msg");
    el.style.display = "block";
    el.className = "msg " + cls;
    el.textContent = text;
  }
  function num(v, fallback) {
    var n = Number(v);
    return isNaN(n) ? fallback : n;
  }
  function slugify(name) {
    var s = String(name || "")
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "product";
  }
  function field(name) {
    return qs("#product-form").elements.namedItem(name);
  }
  function setPreview(src) {
    var prev = qs("#product-image-preview");
    prev.src = src || "";
    prev.hidden = !src;
  }
  function visibilityLabel() {
    var hidden = field("active").value === "false";
    var btn = qs("#btn-visibility");
    btn.hidden = !existing;
    btn.textContent = hidden ? "Show on menu" : "Hide from menu";
  }

  function fillForm(p) {
    field("name").value = p.name || "";
    field("category").value = p.category === "Breads" ? "Breads" : "Cakes";
    field("price").value = p.price;
    field("description").value = p.description || "";
    field("image_url").value = p.image_url || p.image || "";
    field("bake_time_minutes").value = p.bake_time_minutes != null ? p.bake_time_minutes : p.bakeTimeMinutes;
    field("active").value = p.active ? "true" : "false";
    setPreview(field("image_url").value);
    visibilityLabel();
  }

  function payloadFromForm(id, sortOrder) {
    var image = String(field("image_url").value || "").trim();
    var active = field("active").value === "true";
    var kept = existing || {};
    var hasImage = !!image;
    return {
      id: id,
      name: String(field("name").value || "").trim(),
      category: field("category").value === "Breads" ? "Breads" : "Cakes",
      price: num(field("price").value, 0),
      description: field("description").value || "",
      image_url: image,
      image: image,
      bake_time_minutes: num(field("bake_time_minutes").value, 0),
      active: active,
      prep_minutes: num(kept.prep_minutes != null ? kept.prep_minutes : kept.prepMinutes, 0),
      min_lead_minutes: num(kept.min_lead_minutes != null ? kept.min_lead_minutes : kept.minLeadMinutes, 60),
      slots: num(kept.slots, 1) || 1,
      sort_order: existing ? num(kept.sort_order, 0) : sortOrder,
      wholesale_note: kept.wholesale_note || kept.wholesaleNote || "",
      photo_real: photoChanged ? hasImage : existing ? !!(kept.photo_real || kept.photoReal) : hasImage && image.indexOf("data:") !== 0,
      example: photoChanged && hasImage ? false : existing ? !!kept.example : !(hasImage && image.indexOf("data:") !== 0),
    };
  }

  async function uniqueId(name) {
    var base = slugify(name);
    var list = await SB.data.getProducts(true);
    var taken = {};
    list.forEach(function (p) { taken[p.id] = true; });
    if (!taken[base]) return base;
    var n = 2;
    while (taken[base + "-" + n]) n += 1;
    return base + "-" + n;
  }

  async function nextSort() {
    var list = await SB.data.getProducts(true);
    var max = 0;
    list.forEach(function (p) {
      var n = Number(p.sort_order) || 0;
      if (n > max) max = n;
    });
    return max + 1;
  }

  async function saveAndReturn(prod) {
    if (pendingPhoto) {
      show("Uploading photo…", "info");
      var uploadedUrl = await SB.data.uploadProductPhoto(pendingPhoto);
      field("image_url").value = uploadedUrl;
      pendingPhoto = null;
      photoChanged = true;
      prod.image_url = prod.image = uploadedUrl;
      prod.photo_real = true;
      prod.example = false;
      releasePreview();
      setPreview(uploadedUrl);
    }
    await SB.data.saveProduct(prod);
    location.href = LIST;
  }

  document.addEventListener("DOMContentLoaded", async function () {
    await SB.data.init();
    await SB.chrome.boot();
    var session = await SB.data.getSession();
    if (!session) {
      location.replace("account.html");
      return;
    }
    if (!session.user.is_admin) {
      location.replace("index.html");
      return;
    }
    qs("#admin-gate").hidden = true;
    qs("#product-editor").hidden = false;

    var wanted = new URLSearchParams(location.search).get("id");
    if (wanted) {
      var list = await SB.data.getProducts(true);
      existing = list.find(function (p) { return p.id === wanted; }) || null;
      if (!existing) {
        qs("#editor-title").textContent = "Product not found";
        qs("#product-form").hidden = true;
        show("That product is not in the list.", "warn");
        return;
      }
      document.title = "Edit product — Admin — SamalBakes";
      qs("#editor-title").textContent = "Edit product";
      fillForm(existing);
      qs("#btn-delete").hidden = false;
    } else {
      document.title = "Add product — Admin — SamalBakes";
      field("active").value = "true";
      field("category").value = "Cakes";
    }

    field("active").addEventListener("change", visibilityLabel);

    var fileInput = qs("#product-image-file");
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        SB.productPhoto.validate(f);
      } catch (err) {
        show(err.message, "warn");
        fileInput.value = "";
        return;
      }
      if (!SB.data.isDemo) {
        pendingPhoto = f;
        releasePreview();
        previewUrl = URL.createObjectURL(f);
        setPreview(previewUrl);
        show("Photo selected. Save the product to upload it.", "ok");
        return;
      }
      if (f.size > 900000) {
        show("Please choose an image under ~900KB for demo storage.", "warn");
        fileInput.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        field("image_url").value = reader.result;
        setPreview(reader.result);
        show("Photo ready. Save to keep it.", "ok");
      };
      reader.readAsDataURL(f);
    });

    field("image_url").addEventListener("input", function () {
      pendingPhoto = null;
      fileInput.value = "";
      photoChanged = true;
      releasePreview();
      setPreview(field("image_url").value.trim());
    });

    qs("#product-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var submit = e.target.querySelector('[type="submit"]');
      if (submit.disabled) return;
      submit.disabled = true;
      fileInput.disabled = true;
      field("image_url").disabled = true;
      try {
        var id = existing ? existing.id : await uniqueId(field("name").value);
        var sort = existing ? num(existing.sort_order, 0) : await nextSort();
        await saveAndReturn(payloadFromForm(id, sort));
      } catch (err) {
        submit.disabled = false;
        fileInput.disabled = false;
        field("image_url").disabled = false;
        show(err.message || "Could not save.", "warn");
      }
    });

    qs("#btn-visibility").addEventListener("click", async function () {
      field("active").value = field("active").value === "true" ? "false" : "true";
      visibilityLabel();
      qs("#btn-visibility").disabled = true;
      try {
        await saveAndReturn(payloadFromForm(existing.id, num(existing.sort_order, 0)));
      } catch (err) {
        qs("#btn-visibility").disabled = false;
        show(err.message || "Could not update.", "warn");
      }
    });

    document.documentElement.setAttribute("data-product-ready", "1");

    qs("#btn-delete").addEventListener("click", async function () {
      if (!existing) return;
      if (!window.confirm("Delete “" + existing.name + "”? This cannot be undone.")) return;
      qs("#btn-delete").disabled = true;
      try {
        await SB.data.deleteProduct(existing.id);
        location.href = LIST;
      } catch (err) {
        qs("#btn-delete").disabled = false;
        show(err.message || "Could not delete.", "warn");
      }
    });
  });
})();
