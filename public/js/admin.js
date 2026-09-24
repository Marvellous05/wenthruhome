const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const propertyModal = document.getElementById("propertyModal");
const propertyForm = document.getElementById("propertyForm");

let properties = [];

/* =========================================
   HELPERS
========================================= */

const money = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const statusLabels = {
  available: "Available",
  unavailable: "Unavailable",
  "sold-out": "Sold out",
};

const pricePeriods = {
  "per night": "per night",
  "per week": "per week",
  "per month": "per month",
  "per year": "per year",
  "contact for price": "contact for price",
};

function formatPricePeriod(period) {
  return pricePeriods[period] || "";
}

function priceLabel(property) {
  if (property.price_period === "contact for price") {
    return "Contact for price";
  }

  return `${money(property.price)} ${
    formatPricePeriod(property.price_period) || ""
  }`;
}

function imagesOf(property) {
  if (Array.isArray(property.images) && property.images.length) {
    return property.images;
  }

  if (property.image) {
    return [property.image];
  }

  return [];
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return characters[character];
  });
}

function showGlobalError(message) {
  const globalError = document.getElementById("globalError");

  if (globalError) {
    globalError.textContent = message;
  }
}

/* =========================================
   API
========================================= */

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

/* =========================================
   AUTHENTICATION
========================================= */

async function checkAuth() {
  try {
    const user = await api("/api/admin/me");

    if (user.authenticated) {
      showDashboard();
    }
  } catch {
    // The user is not logged in.
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    loginError.textContent = "Please enter your email and password.";
    return;
  }

  loginError.textContent = "Signing in...";

  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    loginError.textContent = "";
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

function showDashboard() {
  loginView?.classList.add("hidden");
  dashboardView?.classList.remove("hidden");

  loadAll().catch((error) => {
    showGlobalError(error.message);
  });
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", {
      method: "POST",
    });

    window.location.reload();
  } catch (error) {
    alert(error.message);
  }
});

/* =========================================
   NAVIGATION
========================================= */

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((item) => item.classList.remove("active"));

    button.classList.add("active");

    const section = button.dataset.section;

    document
      .querySelectorAll(".admin-section")
      .forEach((item) => item.classList.add("hidden"));

    document
      .getElementById(`${section}Section`)
      ?.classList.remove("hidden");

    const pageTitle = document.getElementById("pageTitle");

    if (pageTitle) {
      pageTitle.textContent =
        section.charAt(0).toUpperCase() + section.slice(1);
    }

    if (section === "properties") {
      renderProperties();
    }

    if (section === "bookings") {
      loadBookings().catch((error) => {
        showGlobalError(error.message);
      });
    }
  });
});

document
  .getElementById("addPropertyBtn")
  ?.addEventListener("click", () => {
    openPropertyForm();
  });

document.querySelectorAll("[data-close-property]").forEach((element) => {
  element.addEventListener("click", () => {
    propertyModal?.classList.add("hidden");
    propertyModal?.setAttribute("aria-hidden", "true");
  });
});

/* =========================================
   DASHBOARD DATA
========================================= */

async function loadAll() {
  properties = await api("/api/admin/properties");

  const bookings = await api("/api/admin/bookings");

  document.getElementById("statProperties").textContent = properties.length;

  document.getElementById("statAvailable").textContent =
    properties.filter((property) => property.status === "available").length;

  document.getElementById("statUnavailable").textContent =
    properties.filter((property) => property.status !== "available").length;

  document.getElementById("statBookings").textContent = bookings.length;

  renderProperties();
  renderBookings(bookings);
}

/* =========================================
   PROPERTIES
========================================= */

function renderProperties() {
  const list = document.getElementById("propertyAdminList");

  if (!list) return;

  if (!properties.length) {
    list.innerHTML = `
      <div class="panel">
        No properties yet. Add your first property.
      </div>
    `;

    return;
  }

  list.innerHTML = properties
    .map((property) => {
      const images = imagesOf(property);
      const mainImage = images[0] || "";

      const statusText =
        statusLabels[property.status] || property.status || "Unknown";

      const nextStatus =
        property.status === "available" ? "unavailable" : "available";

      const nextStatusLabel =
        property.status === "available"
          ? "Mark unavailable"
          : "Mark available";

      return `
        <article class="admin-item">
          <div class="admin-item-photo">
            ${
              mainImage
                ? `
                  <img
                    src="${escapeHTML(mainImage)}"
                    alt="${escapeHTML(property.title)}"
                  >
                `
                : `
                  <div class="image-placeholder">
                    No image
                  </div>
                `
            }

            ${
              images.length > 1
                ? `<span>${images.length} photos</span>`
                : ""
            }
          </div>

          <div class="admin-item-info">
            <h3>${escapeHTML(property.title)}</h3>

            <p class="admin-location">
              ${escapeHTML(property.location || "Location not added")}
              ·
              <strong>${escapeHTML(priceLabel(property))}</strong>
            </p>

            <p class="admin-description">
              ${escapeHTML(
                property.description || "No description added yet."
              )}
            </p>

            <span class="badge ${
              property.status === "available" ? "" : "off"
            }">
              ${escapeHTML(statusText)}
            </span>
          </div>

          <div class="actions">
            <button
              class="mini"
              type="button"
              onclick="editProperty(${property.id})"
            >
              Edit
            </button>

            <button
              class="mini"
              type="button"
              onclick="toggleStatus(${property.id}, '${nextStatus}')"
            >
              ${nextStatusLabel}
            </button>

            <button
              class="mini danger"
              type="button"
              onclick="deleteProperty(${property.id})"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================================
   BOOKINGS
========================================= */

function renderBookings(bookings = []) {
  const list = document.getElementById("bookingList");

  if (!list) return;

  if (!bookings.length) {
    list.innerHTML = `
      <div class="panel">
        No booking requests yet.
        Customers who are ready to secure a property
        will continue on WhatsApp.
      </div>
    `;

    return;
  }

  list.innerHTML = bookings
    .map((booking) => {
      const duration = Number(booking.duration_days || 1);

      return `
        <article class="booking">
          <strong>
            ${escapeHTML(
              booking.customer_name || "Unnamed customer"
            )}
          </strong>

          <p>
            <b>Property:</b>
            ${escapeHTML(
              booking.property_title || "Deleted property"
            )}
          </p>

          <p>
            <b>Phone:</b>
            ${escapeHTML(booking.phone || "Not provided")}
          </p>

          <p>
            <b>Dates:</b>
            ${escapeHTML(booking.check_in || "Not set")}
            →
            ${escapeHTML(booking.check_out || "Not set")}
          </p>

          <p>
            <b>Stay:</b>
            ${duration} ${duration === 1 ? "day" : "days"}
          </p>

          <p>
            <b>Estimated total:</b>
            ${
              booking.total_amount
                ? escapeHTML(money(booking.total_amount))
                : "Contact for price"
            }
          </p>

          <p>
            ${escapeHTML(booking.message || "No message.")}
          </p>

          <span class="badge">
            Request received
          </span>
        </article>
      `;
    })
    .join("");
}

async function loadBookings() {
  const bookings = await api("/api/admin/bookings");
  renderBookings(bookings);
}

/* =========================================
   PROPERTY FORM
========================================= */

function openPropertyForm(property = null) {
  if (!propertyForm || !propertyModal) return;

  propertyForm.reset();

  document.getElementById("propertyId").value =
    property?.id || "";

  document.getElementById("formTitle").textContent = property
    ? "Edit property"
    : "Add property";

  document.getElementById("replaceImagesWrap").style.display =
    property ? "flex" : "none";

  document.getElementById("currentGallery").innerHTML = property
    ? imagesOf(property)
        .map(
          (image, index) => `
            <img
              src="${escapeHTML(image)}"
              alt="Photo ${index + 1}"
            >
          `
        )
        .join("")
    : "";

  if (property) {
    document.getElementById("title").value =
      property.title || "";

    document.getElementById("location").value =
      property.location || "";

    document.getElementById("price").value =
      property.price || "";

    document.getElementById("pricePeriod").value =
      property.price_period || "per night";

    document.getElementById("bedrooms").value =
      property.bedrooms || "";

    document.getElementById("bathrooms").value =
      property.bathrooms || "";

    document.getElementById("guests").value =
      property.guests || "";

    document.getElementById("status").value =
      property.status || "available";

    document.getElementById("amenities").value =
      Array.isArray(property.amenities)
        ? property.amenities.join(", ")
        : property.amenities || "";

    document.getElementById("description").value =
      property.description || "";

    document.getElementById("propertyType").value =
      property.property_type || "Serviced Apartment";

    document.getElementById("propertySize").value =
      property.property_size || "";

    document.getElementById("nearbyAttractions").value =
      property.nearby_attractions || "";

    document.getElementById("rules").value =
      property.rules || "";

    document.getElementById("address").value =
      property.address || property.location || "";

    document.getElementById("mapsUrl").value =
      property.maps_url ||
      "https://maps.app.goo.gl/iMhQxUqJk9s43V2t5";

    document.getElementById("mapQuery").value =
      property.map_query ||
      property.address ||
      property.location ||
      "Wenthruhome Apt, Idimu, Lagos";

    document.getElementById("galleryCategory").value = "Property photos";
  }

  document.getElementById("formError").textContent = "";

  propertyModal.classList.remove("hidden");
  propertyModal.setAttribute("aria-hidden", "false");
}

window.editProperty = (id) => {
  const property = properties.find(
    (item) => Number(item.id) === Number(id)
  );

  if (!property) {
    alert("Property could not be found.");
    return;
  }

  openPropertyForm(property);
};

propertyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formError = document.getElementById("formError");

  formError.textContent = "Saving property...";

  const formData = new FormData();

  const fields = [
    "title",
    "propertyType",
    "location",
    "address",
    "price",
    "pricePeriod",
    "bedrooms",
    "bathrooms",
    "guests",
    "propertySize",
    "status",
    "mapQuery",
    "mapsUrl",
    "galleryCategory",
    "amenities",
    "description",
    "nearbyAttractions",
    "rules",
  ];

  fields.forEach((field) => {
    const input = document.getElementById(field);

    if (input) {
      formData.append(field, input.value);
    }
  });

  const imageInput = document.getElementById("images");

  if (imageInput?.files?.length) {
    for (const file of imageInput.files) {
      formData.append("images", file);
    }
  }

  const replaceImages = document.getElementById("replaceImages");

  if (replaceImages?.checked) {
    formData.append("replaceImages", "on");
  }

  try {
    const propertyId =
      document.getElementById("propertyId").value;

    const url = propertyId
      ? `/api/admin/properties/${propertyId}`
      : "/api/admin/properties";

    await api(url, {
      method: propertyId ? "PUT" : "POST",
      body: formData,
    });

    propertyModal.classList.add("hidden");
    propertyModal.setAttribute("aria-hidden", "true");

    await loadAll();
  } catch (error) {
    formError.textContent = error.message;
  }
});

/* =========================================
   PROPERTY ACTIONS
========================================= */

window.toggleStatus = async (id, status) => {
  try {
    await api(`/api/admin/properties/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    });

    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

window.deleteProperty = async (id) => {
  const confirmed = window.confirm(
    "Delete this property and its uploaded photos?"
  );

  if (!confirmed) return;

  try {
    await api(`/api/admin/properties/${id}`, {
      method: "DELETE",
    });

    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

/* =========================================
   START ADMIN APP
========================================= */

checkAuth();