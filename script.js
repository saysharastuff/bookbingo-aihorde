let api_key = "0000000000"

let prompt = `
### System:
Below is an instruction that describes how to generate book challenges as a JSON object. Follow the instructions as best you can.

### Instruction: 
Generate a JSON formatted object including 24 unique and family-friendly book challenges for a book bingo card, like: 
    {'1': 'Award Winner', 
     '2': 'Fiction', 
     '3': 'Bestseller', 
     ...
     '24': ...
    }
    Replace the named challenges above with your own unique challenge descriptions that are concise and brief, 3 words or less. 
    Challenges should be appropriate for middle-grade readers. Return a valid JSON Object.
    
### Response:`;

let selectedModel = null;
let countGenerations = 0;
let debug = false;

const urlParams = new URLSearchParams(window.location.search);

if (urlParams.has('debug')) {
  // Get the value of the 'debug' parameter
  const debugValue = urlParams.get('debug');
  if (debugValue == 1)
    debug = true;
}

function showLoadingIndicator() {
  $("#loadingIndicator").show();
}

function hideLoadingIndicator() {
  $("#loadingIndicator").hide();
}

function showTimeRemaining(result) {

  if (countGenerations > 0)
    $('#generationInfo').html("Generation " + countGenerations + " failed. Trying again.<br />");

  if (result.wait_time) {
    $("#loadingIndicator p").hide();

    $("#timeRemaining").html(
      "Generating Bingo Card...<br />Estimated time remaining: " +
      result.wait_time +
      " seconds."
    );
  } else if (result.queue_position > 0) {
    $("#timeRemaining").html("Generating Bingo Card...<br />Queue position: " + result.queue_position);
  }
}

function ajaxRequest(url, method, headers, data) {
  return $.ajax({
    url: url,
    method: method,
    headers: headers,
    contentType: "application/json",
    dataType: "json",
    data: data ? JSON.stringify(data) : null,
  });
}

function generateBingoCard(challenges) {


  // Convert the challenges object to an array and shuffle it
  let challengeArray = Object.keys(challenges).map(key => challenges[key]);
  for (let i = challengeArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [challengeArray[i], challengeArray[j]] = [challengeArray[j], challengeArray[i]];
  }
  //console.log(challengeArray)
  const grid = $("#bingo-grid");
  grid.empty();

  // Populate first half of the grid
  for (let i = 0; i <= 11; i++) {
    let category = challengeArray[i];
    // Replacing '/' with ' or '
    category = category.replace(/\//g, " or ");
    const cell = $("<div>").addClass("bingo-cell");
    cell.text(category);
    grid.append(cell);
  }

  // Add "Reader's Choice" cell in the middle
  const readersChoiceCell = $("<div>").addClass("bingo-cell");
  readersChoiceCell.css({ backgroundColor: "black", color: "white" });
  readersChoiceCell.text("Reader's Choice");
  grid.append(readersChoiceCell);

  // Populate the second half of the grid
  for (let i = 12; i <= 23; i++) {
    let category = challengeArray[i];
    // Replacing '/' with ' or '
    category = category.replace(/\//g, " or ");
    const cell = $("<div>").addClass("bingo-cell");
    cell.text(category);
    grid.append(cell);
  }

  $("#footer").show();
}

// Function to validate the generated text and possibly regenerate
function validateAndRegenerateIfNeeded(generatedText) {
  if (debug === true)
    console.log(generatedText)
  try {
    const challenges = JSON.parse(generatedText);

    // Check if the result is an object with keys from '1' to '24'
    if (typeof challenges === "object") {
      const keys = Object.keys(challenges);
      if (
        keys.length >= 24 &&
        keys.every((key) => parseInt(key) > 0 && parseInt(key) <= 24)
      ) {
        console.log("Valid JSON object of challenges received.");

        hideLoadingIndicator();
        generateBingoCard(challenges);
      } else {
        console.log("Invalid JSON object. Regenerating...");
        triggerTextGeneration();
      }
    } else {
      console.log("Invalid JSON format. Regenerating...");
      triggerTextGeneration();
    }
  } catch (error) {
    console.error("Error parsing JSON:", error);
    console.log("Invalid JSON format. Regenerating...");
    triggerTextGeneration();
  }
}

async function listAvailableWorkers() {
  const apiUrl = "https://stablehorde.net/api/v2/workers?type=text";
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Apikey: "0000000000",
        "Client-Agent": "Book Bingo Generator:1.0:sayshara@pm.me",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    return data; // This will be an array of models
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

async function generateTextAsync(prompt) {
  const apiUrl = "https://stablehorde.net/api/v2/generate/text/async";
  const data = {
    prompt: prompt,
    params: {
      n: 1,
      max_context_length: 1024,
      max_length: 512,
      rep_pen: 1.1,
      rep_pen_range: 320,
      rep_pen_slope: 0.7,
      singleline: false,
      temperature: 0.7,
      tfs: 1,
      top_a: 0,
      top_k: 0,
      top_p: 0.92,
      typical: 1,
      sampler_order: [6, 0, 1, 3, 4, 2, 5],
    },
    models: [selectedModel],
    use_default_badwordsids: true,
  };
  try {
    const response = await ajaxRequest(
      apiUrl,
      "POST",
      {
        Accept: "application/json",
        Apikey: api_key,
        "Client-Agent": "Book Bingo Generator:1.0:sayshara@pm.me",
      },
      data
    );
    if (debug === true)
      console.log(response)
    return response;
  } catch (error) {
    console.error("Error in text generation:", error);
  }
}

async function generateTextStatus(id) {
  const apiUrl = `https://stablehorde.net/api/v2/generate/text/status/${id}`;

  try {
    const response = await ajaxRequest(apiUrl, "GET", {
      Accept: "application/json",
      Apikey: "0000000000",
      "Client-Agent": "Book Bingo Generator:1.0:sayshara@pm.me",
    });

    showTimeRemaining(response);
    return response;
  } catch (error) {
    console.error("Error fetching generation status:", error);
  }
}

// Function to trigger text generation
function triggerTextGeneration() {
  countGenerations += 1;
  if (countGenerations <= 3) {
    generateTextAsync(prompt)
      .then((response) => {
        if (response?.id) {
          if (debug === true)
            console.log("Job Id", response.id);

          checkGenerationStatus(response.id);
        }
      })
      .catch((error) => {
        console.error("Error in text generation:", error);
      });
  }
  else {
    $('#loadingIndicator').html('Model not available right now. Please try again later.')
    showLoadingIndicator();
  }
}

$(document).ready(function() {
  listAvailableWorkers().then((response) => {

    const modelNamesRegex = /disco|mythom|mythalion|openchat|toppy|noro|neural|sus|stheno|samantha/i;
    let preferredModels = response.filter((model) => model.max_length >= 512
      && model.maintenance_mode === false
      && model.online === true
      && model.models.some((modelName) => modelNamesRegex.test(modelName)))
      .sort((a, b) => parseFloat(b.performance) - parseFloat(a.performance));

    if (debug === true)
      console.log(preferredModels)

    selectedModel = preferredModels.length > 0 && preferredModels[0].models.length > 0 ? preferredModels[0].models[0] : null;

    // Trigger text generation using the selected model
    if (selectedModel) {
      if (debug === true)
        console.log(selectedModel)

      generateTextAsync(prompt)
        .then((response) => {
          if (response?.id) {
            showLoadingIndicator();
            checkGenerationStatus(response.id);
          }
        })
        .catch((error) => {
          console.error("Error in text generation:", error);
        });
    }
    else {
      $('#loadingIndicator').html('Model not available right now. Please try again later.')
      showLoadingIndicator();
    }
  });
});

function checkGenerationStatus(jobId) {
  generateTextStatus(jobId)
    .then((response) => {
      if (response.done) {
        if (
          response?.generations &&
          response?.generations[0] &&
          response?.generations[0].text
        ) {
          if (debug === true)
            console.log(response)
          let generatedText = response.generations[0].text;

          validateAndRegenerateIfNeeded(generatedText);
        }
      } else {
        // If the job is not done, check again after a delay
        setTimeout(() => checkGenerationStatus(jobId), 2000); // Delay of 2 seconds
      }
    })
    .catch((error) => {
      console.error("Error checking generation status:", error);
    });
}
