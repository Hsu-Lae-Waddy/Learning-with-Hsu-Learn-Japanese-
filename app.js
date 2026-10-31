
// ==========================================
// LEARNING WITH HSU
// Japanese Vocabulary Learning App
// ==========================================


// 1. APP DATA
// ------------------------------------------

let vocabulary = [];

let flashIndex = 0;
let flashWords = [];

let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

let libraryPage = 1;
const libraryPageSize = 10;

const progressKey = "learningWithHsuProgress";

let progress = loadProgress();


// 2. LOAD VOCABULARY JSON FILES
// ------------------------------------------

async function loadVocabulary() {

    const files = [
        "vocabulary/n5_vocab_complete.json",
        "vocabulary/n4_vocab_complete.json",
        "vocabulary/n3_vocab_complete.json",
        "vocabulary/n2_vocab_complete.json",
        "vocabulary/n1_vocab_complete.json"
    ];

    try {

        const results = await Promise.all(
            files.map(async (file) => {

                const response = await fetch(file);

                if (!response.ok) {
                    console.warn("Could not load:", file);
                    return [];
                }

                const data = await response.json();

                if (Array.isArray(data)) {
                    return data;
                }

                if (Array.isArray(data.vocabulary)) {
                    return data.vocabulary;
                }

                if (Array.isArray(data.words)) {
                    return data.words;
                }

                if (Array.isArray(data.data)) {
                    return data.data;
                }

                console.warn("Unexpected JSON format:", file);
                return [];

            })
        );

        vocabulary = results
            .flat()
            .map(normalizeWord)
            .filter(word => word.id && word.kanji);

        console.log("Vocabulary loaded:", vocabulary.length);

        // Helpful diagnostic for checking your JSON data.
        console.table(
            vocabulary.slice(0, 10).map(word => ({
                id: word.id,
                kanji: word.kanji,
                hiragana: word.hiragana,
                english: word.english,
                myanmar: word.myanmar
            }))
        );

        if (vocabulary.length === 0) {
            showLoadError("No vocabulary was found. Please check your JSON files.");
            return;
        }

        updateDashboard();
        setupFlashcards();
        setupLibrary();
        setupQuiz();

    } catch (error) {

        console.error("Vocabulary loading error:", error);

        showLoadError(
            "Could not load vocabulary. Please run this project using VS Code Live Server."
        );

    }
}


// 3. NORMALIZE VOCABULARY OBJECTS
// ------------------------------------------

function normalizeWord(word) {

    return {

        id: String(word.id || ""),

        kanji: String(word.kanji || word.word || ""),

        hiragana: String(word.hiragana || word.reading || ""),

        romaji: String(word.romaji || ""),

        english: String(word.english || "").trim(),

        myanmar: String(word.myanmar || "").trim(),

        level: String(word.level || "N5").toUpperCase(),

        category: String(word.category || "General"),

        example: String(word.example || ""),

        exampleRomaji: String(word.exampleRomaji || ""),

        exampleEnglish: String(word.exampleEnglish || ""),

        exampleMyanmar: String(word.exampleMyanmar || "")

    };

}


// 4. PROGRESS STORAGE
// ------------------------------------------

function loadProgress() {

    try {

        const saved = localStorage.getItem(progressKey);

        return saved ? JSON.parse(saved) : {};

    } catch (error) {

        console.error("Progress loading error:", error);
        return {};

    }

}


function saveProgress() {

    localStorage.setItem(
        progressKey,
        JSON.stringify(progress)
    );

}


function getWordStatus(word) {

    return progress[word.id] || "NEW";

}


function setWordStatus(word, status) {

    progress[word.id] = status;

    saveProgress();

    updateDashboard();

}


// 5. DASHBOARD
// ------------------------------------------

function updateDashboard() {

    const total = vocabulary.length;

    const known = vocabulary.filter(
        word => getWordStatus(word) === "KNOWN"
    ).length;

    const practice = vocabulary.filter(
        word => getWordStatus(word) === "PRACTICE"
    ).length;

    const newWords = total - known - practice;

    document.getElementById("total-count").textContent = total;

    document.getElementById("known-count").textContent = known;

    document.getElementById("practice-count").textContent = practice;

    document.getElementById("new-count").textContent = newWords;

    const percentage = total
        ? Math.round((known / total) * 100)
        : 0;

    document.getElementById("progress-percentage").textContent =
        percentage + "%";

    document.getElementById("progress-bar").style.width =
        percentage + "%";

}


// 6. NAVIGATION
// ------------------------------------------

document.querySelectorAll(".nav-button").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.remove("active");
        });

        document.querySelectorAll(".content-section").forEach(section => {
            section.classList.remove("active");
        });

        button.classList.add("active");

        const sectionId = button.dataset.section;

        document.getElementById(sectionId).classList.add("active");

    });

});


// 7. FLASHCARDS
// ------------------------------------------

function setupFlashcards() {

    document.getElementById("flash-level")
        .addEventListener("change", refreshFlashcards);

    document.getElementById("flash-collection")
        .addEventListener("change", refreshFlashcards);

    document.getElementById("reveal-answer")
        .addEventListener("click", revealFlashAnswer);

    document.getElementById("previous-word")
        .addEventListener("click", previousFlashcard);

    document.getElementById("next-word")
        .addEventListener("click", nextFlashcard);

    document.getElementById("mark-practice")
        .addEventListener("click", () => markFlashcard("PRACTICE"));

    document.getElementById("mark-known")
        .addEventListener("click", () => markFlashcard("KNOWN"));

    document.getElementById("flash-audio")
        .addEventListener("click", () => {

            const word = flashWords[flashIndex];

            if (word) {
                speakJapanese(word.kanji);
            }

        });

    document.getElementById("example-audio")
        .addEventListener("click", () => {

            const word = flashWords[flashIndex];

            if (word) {
                speakJapanese(word.example);
            }

        });

    refreshFlashcards();

}


function refreshFlashcards() {

    const level = document.getElementById("flash-level").value;

    const collection =
        document.getElementById("flash-collection").value;

    flashWords = vocabulary.filter(word => {

        const correctLevel =
            level === "ALL" || word.level === level;

        const correctStatus =
            collection === "ALL" ||
            getWordStatus(word) === collection;

        return correctLevel && correctStatus;

    });

    flashIndex = 0;

    renderFlashcard();

}


function renderFlashcard() {

    const answerArea = document.getElementById("flash-answer");

    const revealButton = document.getElementById("reveal-answer");

    if (flashWords.length === 0) {

        document.getElementById("flash-kanji").textContent =
            "No words found";

        document.getElementById("flash-hiragana").textContent = "";

        document.getElementById("flash-romaji").textContent =
            "Try another filter.";

        document.getElementById("flash-number").textContent = "0 / 0";

        answerArea.classList.add("hidden");

        revealButton.classList.add("hidden");

        return;

    }

    const word = flashWords[flashIndex];

    document.getElementById("flash-level-label").textContent = word.level;

    document.getElementById("flash-number").textContent =
        `${flashIndex + 1} / ${flashWords.length}`;

    document.getElementById("flash-kanji").textContent = word.kanji;

    document.getElementById("flash-hiragana").textContent =
        word.hiragana;

    document.getElementById("flash-romaji").textContent =
        word.romaji;

    document.getElementById("flash-english").textContent =
        word.english || "English meaning unavailable.";

    document.getElementById("flash-myanmar").textContent =
        word.myanmar || "Myanmar meaning unavailable.";

    document.getElementById("flash-example").textContent =
        word.example;

    document.getElementById("flash-example-romaji").textContent =
        word.exampleRomaji;

    document.getElementById("flash-example-english").textContent =
        word.exampleEnglish;

    document.getElementById("flash-example-myanmar").textContent =
        word.exampleMyanmar;

    answerArea.classList.add("hidden");

    revealButton.classList.remove("hidden");

    document.getElementById("flash-status").textContent =
        "Status: " + getWordStatus(word);

}


function revealFlashAnswer() {

    document.getElementById("flash-answer")
        .classList.remove("hidden");

    document.getElementById("reveal-answer")
        .classList.add("hidden");

}


function nextFlashcard() {

    if (flashWords.length === 0) return;

    flashIndex = (flashIndex + 1) % flashWords.length;

    renderFlashcard();

}


function previousFlashcard() {

    if (flashWords.length === 0) return;

    flashIndex =
        (flashIndex - 1 + flashWords.length) % flashWords.length;

    renderFlashcard();

}


function markFlashcard(status) {

    if (flashWords.length === 0) return;

    const word = flashWords[flashIndex];

    setWordStatus(word, status);

    document.getElementById("flash-status").textContent =
        status === "KNOWN"
            ? "✓ Marked as Known!"
            : "Marked as Need Practice.";

    // Move to the next word after updating the status.
    // Refreshing removes it if the current collection no longer includes it.
    const currentCollection =
        document.getElementById("flash-collection").value;

    if (currentCollection === status) {

        refreshFlashcards();

    } else {

        renderFlashcard();

    }

}


// 8. JAPANESE TEXT-TO-SPEECH
// ------------------------------------------

function speakJapanese(text) {

    if (!text || !("speechSynthesis" in window)) {

        alert("Japanese audio is not supported by this browser.");

        return;

    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "ja-JP";

    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);

}


// 9. QUIZ
// ------------------------------------------

// Check whether a string contains Japanese characters.
// This helps catch Japanese words mistakenly stored in English fields.

function containsJapanese(text) {

    return /[\u3040-\u30ff\u3400-\u9fff]/u.test(
        String(text || "")
    );

}


// Only accept a valid meaning for the selected answer language.

function validMeaning(word, language) {

    const meaning = String(word[language] || "").trim();

    if (!meaning) return false;

    if (language === "english" && containsJapanese(meaning)) {
        return false;
    }

    return true;

}


function shuffle(array) {

    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [result[i], result[j]] = [result[j], result[i]];

    }

    return result;

}


function setupQuiz() {

    document.getElementById("start-quiz")
        .addEventListener("click", startQuiz);

    document.getElementById("next-question")
        .addEventListener("click", nextQuizQuestion);

    document.getElementById("restart-quiz")
        .addEventListener("click", startQuiz);

    document.getElementById("quiz-audio")
        .addEventListener("click", () => {

            const word = quizQuestions[quizIndex];

            if (word) {
                speakJapanese(word.kanji);
            }

        });

}


function startQuiz() {

    const level = document.getElementById("quiz-level").value;

    const language =
        document.getElementById("quiz-language").value;

    const questionCount = Number(
        document.getElementById("quiz-question-count").value
    );

    // Only use words with a valid answer in the selected language.
    const availableWords = vocabulary.filter(word => {

        const correctLevel =
            level === "ALL" || word.level === level;

        return correctLevel && validMeaning(word, language);

    });

    // Check that there are enough vocabulary words.
    if (availableWords.length < 2) {

        alert(
            "There are not enough valid vocabulary meanings for this quiz. Please check your JSON files."
        );

        return;

    }

    quizQuestions = shuffle(availableWords)
        .slice(0, Math.min(questionCount, availableWords.length));

    quizIndex = 0;

    quizScore = 0;

    quizAnswered = false;

    document.getElementById("quiz-result").classList.add("hidden");

    document.getElementById("quiz-area").classList.remove("hidden");

    renderQuizQuestion();

}


function renderQuizQuestion() {

    if (quizIndex >= quizQuestions.length) {

        showQuizResult();

        return;

    }

    quizAnswered = false;

    const word = quizQuestions[quizIndex];

    const language =
        document.getElementById("quiz-language").value;

    const languageName =
        language === "english" ? "English" : "Myanmar";

    // The correct answer comes ONLY from the selected language field.
    const correctAnswer = String(word[language] || "").trim();

    document.getElementById("quiz-question-number").textContent =
        `Question ${quizIndex + 1} / ${quizQuestions.length}`;

    document.getElementById("quiz-score").textContent =
        `Score: ${quizScore}`;

    document.getElementById("quiz-word-level").textContent =
        word.level;

    document.getElementById("quiz-kanji").textContent =
        word.kanji;

    document.getElementById("quiz-hiragana").textContent =
        word.hiragana;

    document.getElementById("quiz-romaji").textContent =
        word.romaji;

    document.getElementById("quiz-instruction").textContent =
        `Choose the correct ${languageName} meaning.`;

    // Find other words with valid meanings in the same language.
    const wrongAnswers = [
        ...new Set(

            vocabulary

                .filter(item => {

                    return (
                        item.id !== word.id &&
                        validMeaning(item, language) &&
                        String(item[language]).trim() !== correctAnswer
                    );

                })

                .map(item => String(item[language]).trim())

        )
    ];

    // Make sure we have enough different answer choices.
    const selectedWrongAnswers = shuffle(wrongAnswers).slice(0, 3);

    const options = shuffle([
        correctAnswer,
        ...selectedWrongAnswers
    ]);

    const optionsContainer =
        document.getElementById("quiz-options");

    optionsContainer.innerHTML = "";

    options.forEach(option => {

        const button = document.createElement("button");

        button.className = "quiz-option";

        button.textContent = option;

        button.addEventListener("click", () => {

            checkQuizAnswer(button, option, correctAnswer);

        });

        optionsContainer.appendChild(button);

    });

    document.getElementById("quiz-feedback").textContent = "";

    document.getElementById("next-question").classList.add("hidden");

}


function checkQuizAnswer(button, selectedAnswer, correctAnswer) {

    if (quizAnswered) return;

    quizAnswered = true;

    const buttons = document.querySelectorAll(".quiz-option");

    buttons.forEach(option => {

        option.disabled = true;

        if (option.textContent === correctAnswer) {

            option.classList.add("correct");

        }

    });

    if (selectedAnswer === correctAnswer) {

        quizScore++;

        button.classList.add("correct");

        document.getElementById("quiz-feedback").textContent =
            "✓ Correct! Great job!";

    } else {

        button.classList.add("incorrect");

        document.getElementById("quiz-feedback").textContent =
            `Not quite! The correct answer is: ${correctAnswer}`;

    }

    document.getElementById("quiz-score").textContent =
        `Score: ${quizScore}`;

    document.getElementById("next-question")
        .classList.remove("hidden");

}


function nextQuizQuestion() {

    quizIndex++;

    renderQuizQuestion();

}


function showQuizResult() {

    document.getElementById("quiz-area").classList.add("hidden");

    document.getElementById("quiz-result").classList.remove("hidden");

    const total = quizQuestions.length;

    const percentage = Math.round((quizScore / total) * 100);

    document.getElementById("quiz-final-score").textContent =
        `You scored ${quizScore} out of ${total} (${percentage}%).`;

    let message = "";

    if (percentage === 100) {

        message = "Perfect! Excellent work!";

    } else if (percentage >= 70) {

        message = "Great job! Keep practicing!";

    } else if (percentage >= 40) {

        message = "Good effort! You are making progress.";

    } else {

        message = "Keep learning. Practice makes progress!";

    }

    document.getElementById("quiz-final-message").textContent =
        message;

}


// 10. VOCABULARY LIBRARY
// ------------------------------------------

function setupLibrary() {

    document.getElementById("library-search")
        .addEventListener("input", () => {

            libraryPage = 1;

            renderLibrary();

        });

    document.getElementById("library-level")
        .addEventListener("change", resetLibrary);

    document.getElementById("library-category")
        .addEventListener("change", resetLibrary);

    document.getElementById("library-status")
        .addEventListener("change", resetLibrary);

    document.getElementById("library-sort")
        .addEventListener("change", resetLibrary);

    document.getElementById("library-previous")
        .addEventListener("click", () => {

            if (libraryPage > 1) {

                libraryPage--;

                renderLibrary();

            }

        });

    document.getElementById("library-next")
        .addEventListener("click", () => {

            libraryPage++;

            renderLibrary();

        });

    populateCategories();

    renderLibrary();

}


function populateCategories() {

    const categories = [
        ...new Set(vocabulary.map(word => word.category))
    ].sort();

    const select = document.getElementById("library-category");

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category;

        option.textContent = category;

        select.appendChild(option);

    });

}


function resetLibrary() {

    libraryPage = 1;

    renderLibrary();

}


function renderLibrary() {

    const search = document.getElementById("library-search")
        .value.toLowerCase().trim();

    const level = document.getElementById("library-level").value;

    const category =
        document.getElementById("library-category").value;

    const status =
        document.getElementById("library-status").value;

    const sort = document.getElementById("library-sort").value;

    let filtered = vocabulary.filter(word => {

        const searchableText = [

            word.kanji,
            word.hiragana,
            word.romaji,
            word.english,
            word.myanmar,
            word.category

        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesLevel =
            level === "ALL" || word.level === level;

        const matchesCategory =
            category === "ALL" || word.category === category;

        const matchesStatus =
            status === "ALL" || getWordStatus(word) === status;

        return (
            matchesSearch &&
            matchesLevel &&
            matchesCategory &&
            matchesStatus
        );

    });

    if (sort === "japanese") {

        filtered.sort((a, b) =>
            a.kanji.localeCompare(b.kanji, "ja")
        );

    } else if (sort === "english") {

        filtered.sort((a, b) =>
            a.english.localeCompare(b.english)
        );

    }

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / libraryPageSize)
    );

    libraryPage = Math.min(libraryPage, totalPages);

    const start = (libraryPage - 1) * libraryPageSize;

    const pageWords = filtered.slice(
        start,
        start + libraryPageSize
    );

    document.getElementById("library-count").textContent =
        `${filtered.length} vocabulary words found`;

    document.getElementById("library-page").textContent =
        `Page ${libraryPage} of ${totalPages}`;

    document.getElementById("library-previous").disabled =
        libraryPage <= 1;

    document.getElementById("library-next").disabled =
        libraryPage >= totalPages;

    const list = document.getElementById("library-list");

    list.innerHTML = "";

    if (pageWords.length === 0) {

        list.textContent = "No vocabulary found.";

        return;

    }

    pageWords.forEach(word => {

        const card = document.createElement("article");

        card.className = "library-card";

        const title = document.createElement("h3");

        title.textContent = word.kanji;

        const reading = document.createElement("p");

        reading.textContent =
            `${word.hiragana} · ${word.romaji}`;

        const english = document.createElement("p");

        english.textContent = word.english || "English meaning unavailable.";

        const myanmar = document.createElement("p");

        myanmar.textContent = word.myanmar || "Myanmar meaning unavailable.";

        const meta = document.createElement("p");

        meta.className = "muted";

        meta.textContent =
            `${word.level} · ${word.category} · ${getWordStatus(word)}`;

        const audioButton = document.createElement("button");

        audioButton.className = "text-button";

        audioButton.textContent = "🔊 Listen";

        audioButton.addEventListener("click", () => {
            speakJapanese(word.kanji);
        });

        const practiceButton = document.createElement("button");

        practiceButton.className = "text-button";

        practiceButton.textContent = "Need Practice";

        practiceButton.addEventListener("click", () => {

            setWordStatus(word, "PRACTICE");

            renderLibrary();

        });

        const knownButton = document.createElement("button");

        knownButton.className = "text-button";

        knownButton.textContent = "✓ I Know It";

        knownButton.addEventListener("click", () => {

            setWordStatus(word, "KNOWN");

            renderLibrary();

        });

        card.append(
            title,
            reading,
            english,
            myanmar,
            meta,
            audioButton,
            practiceButton,
            knownButton
        );

        list.appendChild(card);

    });

}


// 11. ERROR MESSAGE
// ------------------------------------------

function showLoadError(message) {

    const main = document.querySelector("main");

    const error = document.createElement("p");

    error.className = "error-message";

    error.textContent = message;

    main.prepend(error);

}


// 12. START THE APP
// ------------------------------------------

loadVocabulary();
