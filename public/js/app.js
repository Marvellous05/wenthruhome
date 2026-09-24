const app = document.getElementById('app');

let publicConfig = {
  whatsappNumber: ''
};

const money = (n) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

const statusText = {
  available: 'Available',
  unavailable: 'Unavailable',
  'sold-out': 'Sold out'
};

const periodLabels = {
  'per night': 'per night',
  'per week': 'per week',
  'per month': 'per month',
  'per year': 'per year',
  'contact for price': 'Contact for price'
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));

function toList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function imgs(property) {
  if (Array.isArray(property.images) && property.images.length) {
    return property.images;
  }

  if (property.image) {
    return [property.image];
  }

  return [];
}

function galleryGroups(property) {
  if (Array.isArray(property.gallery) && property.gallery.length) return property.gallery;
  const legacy = imgs(property);
  return legacy.length ? [{ name: 'Property photos', images: legacy }] : [];
}

function priceLabel(property) {
  if (property.price_period === 'contact for price') {
    return 'Contact for price';
  }

  return `${money(property.price)} ${
    periodLabels[property.price_period] || ''
  }`;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function calcTotal(property, days) {
  if (property.price_period === 'contact for price') {
    return null;
  }

  let factor = Number(days);

  if (property.price_period === 'per week') {
    factor = days / 7;
  }

  if (property.price_period === 'per month') {
    factor = days / 30;
  }

  if (property.price_period === 'per year') {
    factor = days / 365;
  }

  return Math.round(Number(property.price || 0) * factor);
}

function niceDate(value) {
  if (!value) {
    return 'Not selected';
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function checkout(value, days) {
  if (!value || !days) {
    return '';
  }

  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + Number(days));

  return date.toISOString().slice(0, 10);
}

function mapSrc(property) {
  const query =
    property.map_query ||
    property.address ||
    property.location ||
    'Wenthruhome Apt, Idimu, Lagos';

  return `https://www.google.com/maps?q=${encodeURIComponent(
    query
  )}&output=embed`;
}

async function api(url, options = {}) {
  const response = await fetch(url, options);

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

async function init() {
  try {
    publicConfig = await api('/api/public-config');
  } catch (error) {
    console.warn('Public configuration could not be loaded.', error);
  }

  const yearElement = document.getElementById('year');

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const currentPath = window.location.pathname;
  const detailMatch = currentPath.match(/^\/apartments\/([^/]+)/);

  if (detailMatch) {
    await renderDetail(detailMatch[1]);
  } else {
    await renderHome();
  }

  setupMobileMenu();
}

function setupMobileMenu() {
  const menuButton = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');

  if (!menuButton || !mobileNav) {
    return;
  }

  menuButton.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
    });
  });
}

async function renderHome() {
  const properties = await api('/api/properties');

  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <div class="kicker">
          SHORT-LET • LONG-STAY • SERVICED LIVING
        </div>

        <h1>
          Stay somewhere that feels
          <em>exceptional.</em>
        </h1>

        <p>
          Discover thoughtfully prepared apartments in Lagos,
          with the comfort, space and service you need for a night,
          a week or much longer.
        </p>

        <div class="hero-actions">
          <a class="btn btn-primary" href="#homes">
            Explore apartments ↗
          </a>

          <a class="btn btn-light" href="#location">
            Find us
          </a>
        </div>
      </div>

      <div class="hero-visual">
        <img
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=88"
          alt="Beautiful serviced apartment interior"
        >

        <div class="hero-stamp">
          <small>Wenthruhome</small>
          <strong>Comfort has an address.</strong>
        </div>
      </div>
    </section>

    <div class="searchbar">
      <label>
        CHECK-IN
        <input id="homeCheckIn" type="date">
      </label>

      <label>
        CHECK-OUT
        <input id="homeCheckOut" type="date">
      </label>

      <label>
        LOCATION
        <select id="homeLocation">
          <option value="">All locations</option>
          ${[
            ...new Set(
              properties
                .map((property) => property.location)
                .filter(Boolean)
            )
          ]
            .map(
              (location) =>
                `<option value="${esc(location)}">${esc(location)}</option>`
            )
            .join('')}
        </select>
      </label>

      <button class="search-btn" id="homeSearch">
        Search stays
      </button>
    </div>

    <section id="homes" class="section">
      <div class="section-head">
        <div>
          <div class="kicker">OUR APARTMENTS</div>
          <h2>Places you'll want to come back to.</h2>
        </div>

        <p>
          Open any apartment to explore its full gallery,
          amenities, rules, availability, location and booking options.
        </p>
      </div>

      <div id="propertyGrid" class="property-grid">
        ${propertyCards(properties)}
      </div>
    </section>

    <section id="experience" class="section experience">
      <div class="kicker">THE WENTHRUHOME EXPERIENCE</div>

      <h2>
        More than a room. A place to settle in.
      </h2>

      <div class="feature-grid">
        <article class="feature">
          <span>01</span>
          <h3>Beautifully prepared</h3>
          <p>
            Spaces designed around comfort, privacy and the little
            details that make a stay feel effortless.
          </p>
        </article>

        <article class="feature">
          <span>02</span>
          <h3>Clear before you book</h3>
          <p>
            See the apartment, facilities, rules, location and pricing
            before you make your decision.
          </p>
        </article>

        <article class="feature">
          <span>03</span>
          <h3>One easy conversation</h3>
          <p>
            When you're ready, your booking details travel with you
            into WhatsApp so the next step is simple.
          </p>
        </article>
      </div>
    </section>

    <section id="location" class="section">
      <div class="location-band">
        <div class="location-copy">
          <div class="kicker">COME FIND US</div>

          <h2>
            Right where your stay begins.
          </h2>

          <p>
            Explore the exact Wenthruhome location on the live Google Map.
            Zoom, move around and get directions from your phone.
          </p>

          <a
            class="directions"
            target="_blank"
            rel="noopener"
            href="https://maps.app.goo.gl/iMhQxUqJk9s43V2t5"
          >
            Open Google Maps ↗
          </a>
        </div>

        <div class="map-card">
          <iframe
            title="Wenthruhome location"
            src="https://www.google.com/maps?q=Wenthruhome%20Apt%2C%20Idimu%2C%20Lagos&output=embed"
            loading="lazy"
          ></iframe>
        </div>
      </div>
    </section>
  `;

  setupHomeSearch(properties);
  setFooterWhatsApp();
}

function propertyCards(properties) {
  if (!Array.isArray(properties) || !properties.length) {
    return `
      <div class="empty">
        No apartments are currently listed.
      </div>
    `;
  }

  return properties
    .map((property) => {
      const images = imgs(property);
      const firstImage = images[0] || '';

      return `
        <article class="property-card">
          <a href="/apartments/${slug(property.title)}-${property.id}">
            <div class="property-photo">
              <img
                src="${esc(firstImage)}"
                alt="${esc(property.title)}"
                loading="lazy"
              >

              <span class="pill ${esc(property.status || '')}">
                ${esc(
                  statusText[property.status] ||
                    property.status ||
                    'Available'
                )}
              </span>

              ${
                images.length > 1
                  ? `
                    <span class="photo-count">
                      ▧ ${images.length} photos
                    </span>
                  `
                  : ''
              }
            </div>

            <div class="property-body">
              <h3>${esc(property.title)}</h3>

              <div class="location-line">
                ⌖ ${esc(property.location)}
              </div>

              <div class="meta-row">
                <span>${esc(property.bedrooms || 0)} bedrooms</span>
                <span>${esc(property.bathrooms || 0)} baths</span>
                <span>${esc(property.guests || 0)} guests</span>
              </div>

              <div class="card-foot">
                <div class="price">
                  ${esc(priceLabel(property))}
                </div>

                <span class="view-link">
                  View apartment →
                </span>
              </div>
            </div>
          </a>
        </article>
      `;
    })
    .join('');
}

function setupHomeSearch(allProperties) {
  const searchButton = document.getElementById('homeSearch');
  const locationSelect = document.getElementById('homeLocation');
  const checkIn = document.getElementById('homeCheckIn');
  const checkOut = document.getElementById('homeCheckOut');

  if (!searchButton) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  if (checkIn) {
    checkIn.min = today;
  }

  if (checkOut) {
    checkOut.min = today;
  }

  if (checkIn && checkOut) {
    checkIn.addEventListener('change', () => {
      checkOut.min = checkIn.value || today;
    });
  }

  searchButton.addEventListener('click', () => {
    const selectedLocation = (
      locationSelect?.value || ''
    ).trim().toLowerCase();

    const filteredProperties = allProperties.filter((property) => {
      const propertyLocation = String(
        property.location || ''
      )
        .trim()
        .toLowerCase();

      return (
        !selectedLocation ||
        propertyLocation === selectedLocation
      );
    });

    const propertyGrid = document.getElementById('propertyGrid');

    if (propertyGrid) {
      propertyGrid.innerHTML = propertyCards(filteredProperties);
    }

    document
      .getElementById('homes')
      ?.scrollIntoView({
        behavior: 'smooth'
      });
  });
}

async function renderDetail(key) {
  const idMatch = key.match(/-(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  let property = null;

  if (id) {
    property = await api(`/api/properties/${id}`).catch(() => null);
  }

  if (!property) {
    const allProperties = await api('/api/properties');

    property = allProperties.find(
      (item) => `${slug(item.title)}-${item.id}` === key
    );
  }

  if (!property) {
    app.innerHTML = `
      <section class="section">
        <div class="empty">
          Apartment not found.
          <a href="/">Return home</a>
        </div>
      </section>
    `;

    return;
  }

  const images = imgs(property);
  const amenities = toList(property.amenities);
  const nearbyAttractions = toList(property.nearby_attractions);
  const rules = toList(property.rules);

  app.innerHTML = `
    <div class="detail-page">
      <div class="detail-crumb">
        <a href="/">Home</a>
        /
        Apartments
        /
        ${esc(property.title)}
      </div>

      <div class="detail-wrap">
        <div class="detail-title">
          <div>
            <div class="kicker">
              ${esc(
                property.property_type ||
                  'SERVICED APARTMENT'
              )}
            </div>

            <h1>${esc(property.title)}</h1>

            <p>
              ⌖ ${esc(property.location)}
            </p>
          </div>

          <div class="detail-price">
            ${esc(priceLabel(property))}
            <small>Starting price</small>
          </div>
        </div>

        <div class="gallery">
          <div class="gallery-main">
            <img
              id="detailMain"
              src="${esc(images[0] || '')}"
              alt="${esc(property.title)}"
            >

            ${
              images.length > 1
                ? `
                  <button
                    class="gallery-arrow prev"
                    id="gPrev"
                    type="button"
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>

                  <button
                    class="gallery-arrow next"
                    id="gNext"
                    type="button"
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                `
                : ''
            }
          </div>

          ${images
            .slice(1, 3)
            .map(
              (image) => `
                <div class="gallery-side">
                  <img
                    class="side-img"
                    src="${esc(image)}"
                    alt="${esc(property.title)}"
                  >
                </div>
              `
            )
            .join('')}

          ${
            images.length > 3
              ? `
                <div class="gallery-more">
                  +${images.length - 3} more photos
                </div>
              `
              : ''
          }
        </div>

        <section class="detail-section categorized-gallery" aria-label="Property photo categories">
          <h2>Explore the property</h2>
          ${galleryGroups(property).map((group, groupIndex) => `
            <div class="gallery-category" data-category-index="${groupIndex}">
              <div class="gallery-category-heading">
                <h3>${esc(group.name)}</h3>
                <span>${group.images.length} photo${group.images.length === 1 ? '' : 's'}</span>
              </div>
              <div class="category-strip">
                ${group.images.map((image, imageIndex) => `
                  <button type="button" class="category-photo" data-category="${groupIndex}" data-photo="${imageIndex}" aria-label="View ${esc(group.name)} photo ${imageIndex + 1}">
                    <img src="${esc(image)}" alt="${esc(group.name)} photo ${imageIndex + 1}">
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </section>

        <div class="facts">
          <div class="fact">
            <strong>${esc(property.bedrooms || 0)}</strong>
            <span>Bedrooms</span>
          </div>

          <div class="fact">
            <strong>${esc(property.bathrooms || 0)}</strong>
            <span>Bathrooms</span>
          </div>

          <div class="fact">
            <strong>${esc(property.guests || 0)}</strong>
            <span>Guests</span>
          </div>
        </div>

        <div class="detail-grid">
          <div>
            <section class="detail-section">
              <h2>About this apartment</h2>

              <p>
                ${esc(
                  property.description ||
                    'A comfortable Wenthruhome apartment prepared for a memorable stay.'
                )}
              </p>
            </section>

            <section class="detail-section">
              <h2>Apartment facilities</h2>

              <div class="amenities">
                ${
                  amenities.length
                    ? amenities
                        .map(
                          (amenity) => `
                            <div class="amenity">
                              ✓ ${esc(amenity)}
                            </div>
                          `
                        )
                        .join('')
                    : `
                      <div class="amenity">
                        Facilities will be updated by Wenthruhome.
                      </div>
                    `
                }
              </div>
            </section>

            ${
              nearbyAttractions.length
                ? `
                  <section class="detail-section">
                    <h2>Nearby attractions</h2>

                    <div class="rules">
                      ${nearbyAttractions
                        .map(
                          (item) => `
                            <div class="rule">
                              📍
                              <span>${esc(item)}</span>
                            </div>
                          `
                        )
                        .join('')}
                    </div>
                  </section>
                `
                : ''
            }

            ${
              rules.length
                ? `
                  <section class="detail-section">
                    <h2>Apartment rules</h2>

                    <div class="rules">
                      ${rules
                        .map(
                          (rule) => `
                            <div class="rule">
                              •
                              <span>${esc(rule)}</span>
                            </div>
                          `
                        )
                        .join('')}
                    </div>
                  </section>
                `
                : ''
            }

            <section class="detail-section">
              <h2>Location</h2>

              <p>
                ${esc(property.address || property.location)}
              </p>

              <div class="map-detail">
                <iframe
                  title="Apartment location"
                  src="${esc(mapSrc(property))}"
                  loading="lazy"
                ></iframe>
              </div>

              <a
                class="directions"
                target="_blank"
                rel="noopener"
                href="${esc(
                  property.maps_url ||
                    'https://maps.app.goo.gl/iMhQxUqJk9s43V2t5'
                )}"
              >
                Get directions ↗
              </a>
            </section>
          </div>

          <aside class="side-book">
            <h3>Book your stay</h3>

            <div class="starting">
              Choose your dates and see an estimated total.
            </div>

            ${
              property.status !== 'available'
                ? `
                  <div class="availability off">
                    <b>
                      ${esc(
                        statusText[property.status] ||
                          'Unavailable'
                      )}
                    </b>

                    <span>
                      This apartment cannot be booked right now.
                    </span>
                  </div>
                `
                : `
                  <div class="availability">
                    ● Available to request
                  </div>

                  <form
                    class="booking-form"
                    id="bookingForm"
                  >
                    <div class="date-grid">
                      <div class="field">
                        <label for="checkIn">
                          CHECK-IN
                        </label>

                        <input
                          id="checkIn"
                          type="date"
                          required
                        >
                      </div>

                      <div class="field">
                        <label for="checkOut">
                          CHECK-OUT
                        </label>

                        <input
                          id="checkOut"
                          type="date"
                          required
                        >
                      </div>
                    </div>

                    <div class="field">
                      <label for="guestCount">
                        GUESTS
                      </label>

                      <select id="guestCount">
                        ${Array.from(
                          {
                            length: Math.max(
                              1,
                              Number(property.guests || 2)
                            )
                          },
                          (_, index) =>
                            `<option value="${index + 1}">
                              ${index + 1}
                            </option>`
                        ).join('')}
                      </select>
                    </div>

                    <div class="field">
                      <label for="customerName">
                        FULL NAME
                      </label>

                      <input
                        id="customerName"
                        required
                        placeholder="Your full name"
                      >
                    </div>

                    <div class="field">
                      <label for="customerPhone">
                        WHATSAPP / PHONE
                      </label>

                      <input
                        id="customerPhone"
                        required
                        placeholder="080..."
                        inputmode="tel"
                      >
                    </div>

                    <div class="summary">
                      <div>
                        <span>Price</span>
                        <b>${esc(priceLabel(property))}</b>
                      </div>

                      <div>
                        <span>Stay</span>
                        <b id="stayCount">
                          Choose dates
                        </b>
                      </div>

                      <div>
                        <span>Check-out</span>
                        <b id="summaryOut">
                          Not selected
                        </b>
                      </div>

                      <div class="total">
                        <span>Estimated total</span>

                        <b id="totalValue">
                          ${
                            property.price_period ===
                            'contact for price'
                              ? 'Contact for price'
                              : 'Select dates'
                          }
                        </b>
                      </div>
                    </div>

                    <div class="pay-question">
                      Ready to pay?
                    </div>

                    <button
                      class="whatsapp-btn"
                      type="submit"
                    >
                      Continue on WhatsApp ↗
                    </button>

                    <div class="notice">
                      Your request is saved first.
                      Wenthruhome will confirm the booking
                      and send payment details through WhatsApp.
                    </div>
                  </form>
                `
            }
          </aside>
        </div>
      </div>
    </div>
  `;

  setupDetail(property, images);
  setFooterWhatsApp();
}

function setupDetail(property, images) {
  let currentIndex = 0;

  document.querySelectorAll('.category-photo').forEach((button) => {
    button.addEventListener('click', () => {
      const group = galleryGroups(property)[Number(button.dataset.category)];
      const image = group?.images?.[Number(button.dataset.photo)];
      if (!image) return;
      openLightbox(galleryGroups(property).flatMap(item => item.images), image);
    });
  });

  const mainImage = document.getElementById('detailMain');

  function showImage(index) {
    if (!mainImage || !images.length) {
      return;
    }

    currentIndex =
      (index + images.length) % images.length;

    mainImage.src = images[currentIndex];
  }

  document
    .getElementById('gPrev')
    ?.addEventListener('click', () => {
      showImage(currentIndex - 1);
    });

  document
    .getElementById('gNext')
    ?.addEventListener('click', () => {
      showImage(currentIndex + 1);
    });

  document
    .querySelectorAll('.side-img')
    .forEach((imageElement, index) => {
      imageElement.addEventListener('click', () => {
        showImage(index + 1);
      });
    });

  mainImage?.addEventListener('click', () => {
    openLightbox(images, currentIndex);
  });

  const checkIn = document.getElementById('checkIn');
  const checkOut = document.getElementById('checkOut');

  if (!checkIn || !checkOut) {
    return;
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  checkIn.min = today;
  checkOut.min = today;

  checkIn.addEventListener('change', () => {
    checkOut.min = checkIn.value || today;
    updateBookingSummary();
  });

  checkOut.addEventListener('change', updateBookingSummary);

  function updateBookingSummary() {
    const stayCount = document.getElementById('stayCount');
    const summaryOut = document.getElementById('summaryOut');
    const totalValue = document.getElementById('totalValue');

    if (!checkIn.value || !checkOut.value) {
      if (stayCount) {
        stayCount.textContent = 'Choose dates';
      }

      if (summaryOut) {
        summaryOut.textContent = 'Not selected';
      }

      if (totalValue) {
        totalValue.textContent =
          property.price_period === 'contact for price'
            ? 'Contact for price'
            : 'Select dates';
      }

      return;
    }

    const startDate = new Date(
      `${checkIn.value}T12:00:00`
    );

    const endDate = new Date(
      `${checkOut.value}T12:00:00`
    );

    const days = Math.round(
      (endDate - startDate) / 86400000
    );

    if (days <= 0) {
      if (stayCount) {
        stayCount.textContent = 'Select valid dates';
      }

      if (summaryOut) {
        summaryOut.textContent = niceDate(checkOut.value);
      }

      if (totalValue) {
        totalValue.textContent = 'Select valid dates';
      }

      return;
    }

    if (stayCount) {
      stayCount.textContent =
        `${days} night${days === 1 ? '' : 's'}`;
    }

    if (summaryOut) {
      summaryOut.textContent = niceDate(checkOut.value);
    }

    const total = calcTotal(property, days);

    if (totalValue) {
      totalValue.textContent =
        total === null
          ? 'Contact for price'
          : money(total);
    }
  }

  document
    .getElementById('bookingForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!checkIn.value || !checkOut.value) {
        alert(
          'Please choose your check-in and check-out dates.'
        );

        return;
      }

      const startDate = new Date(
        `${checkIn.value}T12:00:00`
      );

      const endDate = new Date(
        `${checkOut.value}T12:00:00`
      );

      const days = Math.round(
        (endDate - startDate) / 86400000
      );

      if (days <= 0) {
        alert(
          'Check-out must be after check-in.'
        );

        return;
      }

      const customerName = document
        .getElementById('customerName')
        ?.value.trim();

      const customerPhone = document
        .getElementById('customerPhone')
        ?.value.trim();

      const guestCount = document
        .getElementById('guestCount')
        ?.value;

      const total = calcTotal(property, days);

      const bookingData = {
        propertyId: property.id,
        customerName,
        phone: customerPhone,
        guests: Number(guestCount || 1),
        checkIn: checkIn.value,
        checkOut: checkOut.value,
        durationDays: days,
        totalAmount: total || 0
      };

      try {
        await api('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        });

        const message = [
          'Hello Wenthruhome, I am ready to secure this apartment.',
          '',
          `Property: ${property.title}`,
          `Location: ${property.location}`,
          `Listed price: ${priceLabel(property)}`,
          `Check-in: ${niceDate(checkIn.value)}`,
          `Check-out: ${niceDate(checkOut.value)}`,
          `Stay: ${days} night${days === 1 ? '' : 's'}`,
          `Guests: ${guestCount || 1}`,
          `Estimated total: ${
            total === null
              ? 'Please confirm the amount'
              : money(total)
          }`,
          '',
          `My name: ${customerName}`,
          `My WhatsApp/phone: ${customerPhone}`,
          '',
          'Please send the payment details/account number and confirm availability.'
        ].join('\n');

        if (publicConfig.whatsappNumber) {
          window.location.href =
            `https://wa.me/${publicConfig.whatsappNumber}?text=${encodeURIComponent(
              message
            )}`;
        } else {
          alert(
            'Booking request saved. WhatsApp number has not been configured yet.'
          );
        }
      } catch (error) {
        alert(
          error.message ||
            'Could not save your booking request.'
        );
      }
    });
}

function openLightbox(images, startingIndex = 0) {
  if (!images.length) {
    return;
  }

  const lightbox = document.createElement('div');

  lightbox.className = 'lightbox';

  let currentIndex = startingIndex;

  lightbox.innerHTML = `
    <button
      class="close"
      type="button"
      aria-label="Close gallery"
    >
      ×
    </button>

    <button
      class="prev"
      type="button"
      aria-label="Previous photo"
    >
      ‹
    </button>

    <img
      src="${esc(images[currentIndex])}"
      alt="Apartment gallery image"
    >

    <button
      class="next"
      type="button"
      aria-label="Next photo"
    >
      ›
    </button>
  `;

  document.body.appendChild(lightbox);

  const imageElement = lightbox.querySelector('img');
  const closeButton = lightbox.querySelector('.close');
  const previousButton = lightbox.querySelector('.prev');
  const nextButton = lightbox.querySelector('.next');

  function renderImage() {
    currentIndex =
      (currentIndex + images.length) % images.length;

    imageElement.src = images[currentIndex];
  }

  closeButton.addEventListener('click', () => {
    lightbox.remove();
  });

  previousButton.addEventListener('click', () => {
    currentIndex -= 1;
    renderImage();
  });

  nextButton.addEventListener('click', () => {
    currentIndex += 1;
    renderImage();
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      lightbox.remove();
    }
  });

  document.addEventListener(
    'keydown',
    function handleKeydown(event) {
      if (!document.body.contains(lightbox)) {
        document.removeEventListener(
          'keydown',
          handleKeydown
        );

        return;
      }

      if (event.key === 'Escape') {
        lightbox.remove();
      }

      if (event.key === 'ArrowLeft') {
        currentIndex -= 1;
        renderImage();
      }

      if (event.key === 'ArrowRight') {
        currentIndex += 1;
        renderImage();
      }
    }
  );
}

function setFooterWhatsApp() {
  const footerWhatsApp =
    document.getElementById('footerWhatsApp');

  if (!footerWhatsApp) {
    return;
  }

  if (publicConfig.whatsappNumber) {
    footerWhatsApp.href =
      `https://wa.me/${publicConfig.whatsappNumber}`;

    footerWhatsApp.target = '_blank';
    footerWhatsApp.rel = 'noopener';
  } else {
    footerWhatsApp.removeAttribute('href');
  }
}

init().catch((error) => {
  console.error(error);

  if (app) {
    app.innerHTML = `
      <section class="section">
        <div class="empty">
          Could not load Wenthruhome right now.
          Please refresh the page and try again.
        </div>
      </section>
    `;
  }
});