// Scryfall API calls
async function fetchCardData(cardName) {
    try {
        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
        if (response.status === 404) {
            return null; // Card not found
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching card data:", error);
        return null;
    }
}
async function fetchCardPrintings(printsSearchUri) {
    try {
        const response = await fetch(printsSearchUri);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("Error fetching card printings:", error);
        return [];
    }
}

// Helpers
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function removeCardElements(cardName) {
    const cardElements = document.querySelectorAll(`[card-name="${cardName}"]`);

    // Iterate over card elements and remove them
    cardElements.forEach((cardElement) => {
        cardElement.remove();
    });

    // Remove all empty collapsibles
    const collapsibles = document.getElementsByClassName("collapsable");
    [...collapsibles].forEach((collapsible) => {
        const cardElementsInCollapsible = collapsible.getElementsByClassName("card");
        if (cardElementsInCollapsible.length === 0) {
            collapsible.remove();
        } else {
            const countElement = collapsible.firstChild.nextElementSibling;
            countElement.textContent = ` (${cardElementsInCollapsible.length})`;
        }
    });
}

// Factories
function makeCardElement(card) {
    const cardElement = document.createElement("div");
    cardElement.classList.add("card")
    cardElement.setAttribute("card-name", card.name);

    const cardLink = document.createElement("a");
    cardLink.href = card.scryfall_uri; // Set the URL as the href attribute
    cardLink.target = "_blank"; // Open the link in a new tab

    const cardImage = document.createElement("img")
    if (card.card_faces) { // Handle dual-faced cards
        cardImage.src = card.card_faces[0].image_uris.small;
    } else {
        cardImage.src = card.image_uris.normal;
    }
    cardImage.title = card.name;

    cardLink.appendChild(cardImage);
    cardElement.appendChild(cardLink);

    cardImage.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        removeCardElements(card.name);
    });

    return cardElement;
}
function makeCollapsableElement() {
    // Create elements
    const element = document.createElement("div");
    const buttonElement = document.createElement("button");
    const countElement = document.createElement("span");
    const contentElement = document.createElement("div");

    // Define classes
    element.classList.add("collapsable");
    buttonElement.classList.add("collapsable-button");
    contentElement.classList.add("collapsable-content");

    // Set attributes
    contentElement.style.display = "none";

    // Add event listeners
    buttonElement.addEventListener("click", () => {
        buttonElement.classList.toggle("active");
        if (contentElement.style.display === "block") {
            contentElement.style.display = "none";
        } else {
            contentElement.style.display = "block";
        }
    });

    // Link together
    element.appendChild(buttonElement);
    element.appendChild(countElement);
    element.appendChild(contentElement);

    return element;
}

// Functions
async function displayCards(cardsList) {
    const loadingIndicator = document.getElementById("loading-indicator");
    const container = document.getElementById("results-container");
    const setTypeFilter = document.getElementById("set-type-filter");
    const rarityFilter = document.getElementById("rarity-filter");

    // Clear previous content
    container.innerHTML = "";

    const setCollapsibles = {}; // Mapping of set name to collapsible element

    loadingIndicator.textContent = "Getting all printings...";
    for (const card of cardsList) {
        sleep(100);
        const cardPrintings = await fetchCardPrintings(card.prints_search_uri);

        for (const printing of cardPrintings) {
            const setName = printing.set_name;

            // Filter out unselected card sets and rarities
            const selectedSetTypes = Array.from(setTypeFilter.selectedOptions, option => option.value);
            const selectedRarities = Array.from(rarityFilter.selectedOptions, option => option.value);

            if (
                (selectedSetTypes.length === 0 || selectedSetTypes.includes(printing.set_type)) &&
                (selectedRarities.length === 0 || selectedRarities.includes(printing.rarity))
            ) {


                let collapsible = setCollapsibles[setName];

                if (!collapsible) {
                    collapsible = makeCollapsableElement();
                    setCollapsibles[setName] = collapsible;
                    collapsible.count = 0; // Initialize count property for tracking card elements
                    const header = collapsible.firstChild;
                    header.textContent = setName;
                }

                const cardElement = makeCardElement(printing);
                collapsible.lastChild.appendChild(cardElement);
                collapsible.count++; // Increment count property for each card element
            }
        }
    }

    // Sort collapsibles based on the count property in descending order
    loadingIndicator.textContent = "Sorting...";
    const sortedCollapsibles = Object.values(setCollapsibles).sort(
        (a, b) => b.count - a.count
    );

    for (const collapsible of sortedCollapsibles) {
        // Update collapsible count
        const countElement = collapsible.firstChild.nextElementSibling;
        countElement.textContent = ` (${collapsible.count})`;

        // Append collapsibles to the container in the sorted order
        container.appendChild(collapsible);
    }

    // Done
    loadingIndicator.textContent = "";
}

// Event Handlers and Listeners
async function handlDecklistSubmit(event) {
    event.preventDefault();

    const decklistInput = document.getElementById("decklist-input");
    const decklistSubmit = document.getElementById("decklist-submit");
    const loadingIndicator = document.getElementById("loading-indicator");
    const errorContainer = document.getElementById("error-container");
    const resultsContainer = document.getElementById("results-container");

    const cardsList = [];

    // Clear any previous errors
    errorContainer.innerHTML = "";

    const decklist = decklistInput.value;
    const lines = decklist.split("\n");

    loadingIndicator.textContent = "Loading inital card data...";
    decklistSubmit.disabled = true;

    for (const line of lines) { // Populate card list
        await sleep(100);

        // Ignore empty lines
        if (line.trim() === "") continue;
        // Remove any whitespace as well as any numbers from the start of each line
        const cleanedLine = line.replace(/^\s*\d*\s*|\s*$/g, "");

        const card = await fetchCardData(cleanedLine);

        if (!card) {
            // Display error message
            const errorMessage = document.createElement("p");
            errorMessage.textContent = `Card not found: ${cleanedLine}`;
            errorContainer.appendChild(errorMessage);
            cardsList.length = 0;
            break; // Stop fetching cards
        }
        cardsList.push(card);
    }
    loadingIndicator.textContent = "";
    decklistSubmit.disabled = false;

    await displayCards(cardsList);
}

document.getElementById("decklist-form").addEventListener("submit", handlDecklistSubmit);