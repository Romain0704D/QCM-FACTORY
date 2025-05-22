// Variables globales
let qcmData = null;
let currentQuestionIndex = 0;
let selectedAnswers = [];
let questionOrder = []; // Tableau pour gérer l'ordre des questions
let originalOrder = []; // Tableau pour conserver l'ordre original
let errorTracking = {}; // Suivi des erreurs par question
let answersRevealed = false; // État de révélation des réponses
let visitedQuestions = new Set(); // Suivi des questions visitées
let navigatorExpanded = true;

// Éléments DOM
const questionContainer = document.getElementById('question-container');
const validateBtn = document.getElementById('validate-btn');
const messageContainer = document.getElementById('message-container');
const currentQuestionSpan = document.getElementById('current-question');
const totalQuestionsSpan = document.getElementById('total-questions');
const questionIdSpan = document.getElementById('question-id');
const progressFill = document.getElementById('progress-fill');
const scrollToTopBtn = document.getElementById('scroll-to-top');

// Fonction pour mélanger un tableau (algorithme Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Fonction pour mélanger les questions
function shuffleQuestions() {
    if (!qcmData || !qcmData.qcm) return;
    
    // Sauvegarder les réponses en cours si on est en milieu de QCM
    const wasInProgress = currentQuestionIndex > 0;
    
    if (wasInProgress) {
        const confirmShuffle = confirm('⚠️ Mélanger les questions va redémarrer le QCM. Continuer ?');
        if (!confirmShuffle) return;
    }
    
    // Créer un nouvel ordre aléatoire
    questionOrder = shuffleArray(originalOrder);
    
    // Redémarrer le QCM
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    
    showMessage('🔀 Questions mélangées ! Le QCM a redémarré.', 'info');
    setTimeout(clearMessage, 2000);
}

// Fonction pour remettre l'ordre original
function resetOrder() {
    if (!qcmData || !qcmData.qcm) return;
    
    const wasInProgress = currentQuestionIndex > 0;
    
    if (wasInProgress) {
        const confirmReset = confirm('⚠️ Remettre l\'ordre original va redémarrer le QCM. Continuer ?');
        if (!confirmReset) return;
    }
    
    // Remettre l'ordre original
    questionOrder = [...originalOrder];
    
    // Redémarrer le QCM
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    
    showMessage('↩️ Ordre original restauré ! Le QCM a redémarré.', 'info');
    setTimeout(clearMessage, 2000);
}

// Chargement du fichier JSON
async function loadQCMData() {
    try {
        showMessage('🔄 Chargement des questions...', 'info');
        
        // Option 1: Chargement depuis un fichier JSON externe
        const response = await fetch('questions.json');
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        qcmData = await response.json();
        
        if (!qcmData || !qcmData.qcm || qcmData.qcm.length === 0) {
            throw new Error('Aucune question trouvée dans le fichier JSON');
        }
        
        clearMessage();
        init();
        
    } catch (error) {
        console.error('Erreur lors du chargement du fichier JSON:', error);
        showFileUploadOption();
    }
}

// Option alternative: Upload de fichier
function showFileUploadOption() {
    // Masquer les éléments de navigation et d'interface
    hideNavigationElements();
    
    questionContainer.innerHTML = `
        <div class="upload-container">
            <div class="upload-icon">📁</div>
            <h3>Chargement des questions</h3>
            <p>Le fichier questions.json n'a pas été trouvé.</p>
            <p>Veuillez sélectionner votre fichier JSON contenant les questions :</p>
            <input type="file" id="jsonFileInput" accept=".json" class="file-input">
            <button onclick="loadFromFile()" class="upload-btn">Charger les questions</button>
        </div>
    `;
}

// Modification de la fonction hideNavigationElements()
function hideNavigationElements() {
    const elementsToHide = [
        document.querySelector('.shuffle-controls'),
        document.getElementById('question-navigator'),
        document.querySelector('.question-counter'),
        document.querySelector('.progress-bar'),
        document.getElementById('validate-btn'),
        document.getElementById('scroll-to-top')
    ];
    
    elementsToHide.forEach(element => {
        if (element) {
            element.style.display = 'none';
        }
    });
}

// Modification de la fonction showNavigationElements()
function showNavigationElements() {
    const elementsToShow = [
        document.querySelector('.shuffle-controls'),
        document.getElementById('question-navigator'),
        document.querySelector('.question-counter'),
        document.querySelector('.progress-bar'),
        document.getElementById('validate-btn'),
        document.getElementById('scroll-to-top')
    ];
    
    elementsToShow.forEach(element => {
        if (element) {
            element.style.display = '';
        }
    });
    
    // Restaurer l'état du navigateur
    setTimeout(restoreNavigatorState, 0);
}

// Chargement depuis un fichier uploadé
function loadFromFile() {
    const fileInput = document.getElementById('jsonFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Veuillez sélectionner un fichier JSON', 'error');
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        showMessage('Veuillez sélectionner un fichier JSON valide', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            qcmData = JSON.parse(e.target.result);
            
            if (!qcmData || !qcmData.qcm || qcmData.qcm.length === 0) {
                throw new Error('Format JSON invalide - propriété "qcm" manquante ou vide');
            }
            
            clearMessage();
            init();
            
        } catch (error) {
            console.error('Erreur lors du parsing JSON:', error);
            showMessage(`Erreur dans le fichier JSON: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        showMessage('Erreur lors de la lecture du fichier', 'error');
    };
    
    reader.readAsText(file);
}

// Initialisation
function init() {
    // Réafficher les éléments de navigation si ils étaient cachés
    showNavigationElements();
    
    // Créer l'ordre initial des questions (indices)
    originalOrder = qcmData.qcm.map((_, index) => index);
    questionOrder = [...originalOrder];
    
    totalQuestionsSpan.textContent = qcmData.qcm.length;
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
}

// Modification de la fonction createQuestionNavigator()
function createQuestionNavigator() {
    const questionButtonsContainer = document.getElementById('question-buttons');
    questionButtonsContainer.innerHTML = '';
    
    questionOrder.forEach((questionIndex, orderIndex) => {
        const question = qcmData.qcm[questionIndex];
        const button = document.createElement('button');
        button.className = 'question-nav-btn';
        button.textContent = orderIndex + 1;
        button.setAttribute('data-question-index', orderIndex);
        button.setAttribute('title', `Question ${orderIndex + 1}${question.id ? ` (ID: ${question.id})` : ''}`);
        button.onclick = () => goToQuestion(orderIndex);
        
        questionButtonsContainer.appendChild(button);
    });
    
    updateNavigatorDisplay();
    
    // Restaurer l'état du navigateur après création
    setTimeout(restoreNavigatorState, 0);
}

// Mise à jour de l'affichage du navigateur
function updateNavigatorDisplay() {
    const buttons = document.querySelectorAll('.question-nav-btn');
    
    buttons.forEach((button, index) => {
        const questionIndex = questionOrder[index];
        
        // Retirer toutes les classes d'état
        button.classList.remove('current', 'visited', 'error-marked');
        
        // Question actuelle
        if (index === currentQuestionIndex) {
            button.classList.add('current');
        }
        // Question visitée
        else if (visitedQuestions.has(index)) {
            button.classList.add('visited');
        }
        
        // Question marquée comme fausse
        if (errorTracking[questionIndex]) {
            button.classList.add('error-marked');
        }
    });
}

// Navigation vers une question spécifique
function goToQuestion(questionIndex) {
    if (questionIndex < 0 || questionIndex >= qcmData.qcm.length) return;
    
    // Marquer la question actuelle comme visitée avant de partir
    visitedQuestions.add(currentQuestionIndex);
    
    // Changer de question
    currentQuestionIndex = questionIndex;
    displayQuestion();
    updateProgress();
    updateNavigatorDisplay();
    
    // Scroll vers le haut pour voir la nouvelle question
    scrollToTop();
}

// Fonction de scroll vers le haut
function scrollToTop() {
    window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
    });
}

// Gestion de l'affichage du bouton scroll to top
function handleScrollToTopVisibility() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    if (scrollY > 300) {
        scrollToTopBtn.classList.add('visible');
    } else {
        scrollToTopBtn.classList.remove('visible');
    }
}

// Fonction pour obtenir la question courante selon l'ordre défini
function getCurrentQuestion() {
    const questionIndex = questionOrder[currentQuestionIndex];
    return qcmData.qcm[questionIndex];
}

// Fonction pour obtenir l'ID de la question courante
function getCurrentQuestionId() {
    const questionIndex = questionOrder[currentQuestionIndex];
    return questionIndex;
}

function displayQuestion() {
    const question = getCurrentQuestion();
    selectedAnswers = [];
    answersRevealed = false;
    
    // Marquer la question comme visitée
    visitedQuestions.add(currentQuestionIndex);
    
    let html = '';
    
    // Image si présente
    if (question.image && question.image.trim() !== '') {
        html += `
            <div class="image-container">
                <img src="${question.image}" alt="Image de la question" class="question-image" 
                     onload="this.style.opacity='1'" 
                     onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>❌ Impossible de charger l\\'image<br><small>${question.image}</small></div>'">
            </div>
        `;
    }
    
    // Question
    html += `<div class="question-text">${question.question}</div>`;
    
    // Options
    html += '<div class="options-container">';
    question.options.forEach((option, index) => {
        html += `
            <div class="option" data-option="${index + 1}" id="option-container-${index + 1}">
                <input type="checkbox" id="option-${index + 1}" value="${index + 1}" onchange="handleOptionChange(${index + 1})">
                <label for="option-${index + 1}" class="option-text">${option}</label>
            </div>
        `;
    });
    html += '</div>';

    // Contrôles d'apprentissage
    html += `
        <div class="learning-controls">
            <button onclick="showCorrectAnswers()" class="show-answer-btn" id="show-answer-btn">
                💡 Afficher la/les bonne(s) réponse(s)
            </button>
            <div id="answer-display" class="answer-revealed" style="display: none;"></div>
        </div>
    `;

    // Suivi des erreurs
    html += `
        <div class="error-tracking">
            <input type="checkbox" id="error-checkbox" onchange="handleErrorTracking()">
            <label for="error-checkbox">❌ J'ai eu faux à cette question</label>
        </div>
    `;
    
    questionContainer.innerHTML = html;
    currentQuestionSpan.textContent = currentQuestionIndex + 1;
    questionIdSpan.textContent = question.id || 'N/A';
    
    // Restaurer l'état de suivi d'erreur si existant
    const questionId = getCurrentQuestionId();
    if (errorTracking[questionId]) {
        document.getElementById('error-checkbox').checked = true;
    }
    
    // Mettre à jour le navigateur
    updateNavigatorDisplay();
    
    clearMessage();
}

// Fonction pour afficher les bonnes réponses
function showCorrectAnswers() {
    if (answersRevealed) return;
    
    const question = getCurrentQuestion();
    const correctAnswer = question.correct_answer;
    const answerDisplay = document.getElementById('answer-display');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    
    // Marquer les options correctes visuellement
    if (Array.isArray(correctAnswer)) {
        correctAnswer.forEach(answerNum => {
            const optionContainer = document.getElementById(`option-container-${answerNum}`);
            if (optionContainer) {
                optionContainer.classList.add('correct-answer');
            }
        });
    } else {
        const optionContainer = document.getElementById(`option-container-${correctAnswer}`);
        if (optionContainer) {
            optionContainer.classList.add('correct-answer');
        }
    }
    
    // Afficher le texte des bonnes réponses
    let correctAnswersText = '';
    if (Array.isArray(correctAnswer)) {
        const correctOptions = correctAnswer.map(num => `${num}. ${question.options[num - 1]}`);
        correctAnswersText = `✅ Bonnes réponses : <br>${correctOptions.join('<br>')}`;
    } else {
        correctAnswersText = `✅ Bonne réponse : ${correctAnswer}. ${question.options[correctAnswer - 1]}`;
    }
    
    answerDisplay.innerHTML = correctAnswersText;
    answerDisplay.style.display = 'block';
    showAnswerBtn.disabled = true;
    showAnswerBtn.textContent = '✅ Réponses affichées';
    
    answersRevealed = true;
}

// Gestion du suivi des erreurs
function handleErrorTracking() {
    const questionId = getCurrentQuestionId();
    const isChecked = document.getElementById('error-checkbox').checked;
    
    if (isChecked) {
        errorTracking[questionId] = true;
    } else {
        delete errorTracking[questionId];
    }
    
    // Mettre à jour l'affichage du navigateur
    updateNavigatorDisplay();
}

// Gestion de la sélection des options
function handleOptionChange(optionNumber) {
    const checkbox = document.getElementById(`option-${optionNumber}`);
    
    if (checkbox.checked) {
        if (!selectedAnswers.includes(optionNumber)) {
            selectedAnswers.push(optionNumber);
        }
    } else {
        selectedAnswers = selectedAnswers.filter(answer => answer !== optionNumber);
    }
}

function toggleOption(optionNumber) {
    const checkbox = document.getElementById(`option-${optionNumber}`);
    checkbox.checked = !checkbox.checked;
    handleOptionChange(optionNumber);
}

// Validation de la réponse
function validateAnswer() {
    if (selectedAnswers.length === 0) {
        showMessage('Veuillez sélectionner au moins une réponse.', 'error');
        return;
    }

    const question = getCurrentQuestion();
    const correctAnswer = question.correct_answer;
    
    let isCorrect = false;
    
    if (Array.isArray(correctAnswer)) {
        // Réponse multiple
        isCorrect = correctAnswer.length === selectedAnswers.length && 
                   correctAnswer.every(answer => selectedAnswers.includes(answer));
    } else {
        // Réponse unique
        isCorrect = selectedAnswers.length === 1 && selectedAnswers[0] === correctAnswer;
    }
    
    if (isCorrect) {
        showMessage('✅ Bonne réponse ! Passage à la question suivante...', 'success');
        setTimeout(() => {
            nextQuestion();
        }, 1500);
    } else {
        showMessage('❌ Réponse incorrecte. Veuillez recommencer.', 'error');
    }
}

// Question suivante
function nextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex >= qcmData.qcm.length) {
        showCompletion();
    } else {
        displayQuestion();
        updateProgress();
    }
}

// Mise à jour de la barre de progression
function updateProgress() {
    const progress = ((currentQuestionIndex + 1) / qcmData.qcm.length) * 100;
    progressFill.style.width = progress + '%';
}

// Affichage des messages
function showMessage(text, type) {
    let messageClass = 'error-message';
    if (type === 'success') messageClass = 'success-message';
    if (type === 'info') messageClass = 'info-message';
    
    messageContainer.innerHTML = `<div class="message ${messageClass}">${text}</div>`;
}

function clearMessage() {
    messageContainer.innerHTML = '';
}

// Calcul des statistiques d'erreurs
function calculateErrorStats() {
    const totalQuestions = qcmData.qcm.length;
    const questionsWithErrors = Object.keys(errorTracking).length;
    const successRate = questionsWithErrors > 0 ? 
        ((questionsWithErrors - questionsWithErrors) / questionsWithErrors * 100).toFixed(1) : 100;
    const errorRate = totalQuestions > 0 ? 
        (questionsWithErrors / totalQuestions * 100).toFixed(1) : 0;
    
    return {
        totalQuestions,
        questionsWithErrors,
        questionsCorrect: totalQuestions - questionsWithErrors,
        successRate: ((totalQuestions - questionsWithErrors) / totalQuestions * 100).toFixed(1),
        errorRate
    };
}

// Fin du QCM
function showCompletion() {
    const stats = calculateErrorStats();
    
    questionContainer.innerHTML = `
        <div class="completion-card">
            <h2>🎉 Félicitations !</h2>
            <p>Vous avez terminé le QCM avec succès !</p>
            
            <div class="stats-container">
                <h3 style="color: #4ade80; margin-bottom: 15px;">📊 Statistiques de performance</h3>
                
                <div class="stat-item">
                    <span class="stat-label">Total des questions :</span>
                    <span class="stat-value">${stats.totalQuestions}</span>
                </div>
                
                <div class="stat-item">
                    <span class="stat-label">Questions réussies :</span>
                    <span class="stat-value">${stats.questionsCorrect}</span>
                </div>
                
                <div class="stat-item">
                    <span class="stat-label">Questions marquées comme fausses :</span>
                    <span class="stat-value error">${stats.questionsWithErrors}</span>
                </div>
                
                <div class="stat-item">
                    <span class="stat-label">Taux de réussite :</span>
                    <span class="stat-value">${stats.successRate}%</span>
                </div>
                
                <div class="stat-item">
                    <span class="stat-label">Taux d'erreur :</span>
                    <span class="stat-value error">${stats.errorRate}%</span>
                </div>
            </div>
            
            ${stats.questionsWithErrors > 0 ? `
                <div style="margin: 20px 0; padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px;">
                    <p style="color: #fca5a5;">💡 <strong>Conseil :</strong> Vous avez marqué ${stats.questionsWithErrors} question(s) comme fausse(s). 
                    Pensez à réviser ces points pour améliorer vos connaissances !</p>
                </div>
            ` : `
                <div style="margin: 20px 0; padding: 15px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px;">
                    <p style="color: #86efac;">🌟 <strong>Excellent !</strong> Vous n'avez marqué aucune question comme fausse. 
                    Vos connaissances semblent solides sur ce sujet !</p>
                </div>
            `}
            
            <button class="restart-btn" onclick="restartQCM()">🔄 Recommencer le QCM</button>
            <button class="restart-btn" onclick="restartWithShuffle()" style="margin-left: 10px;">🔀 Recommencer avec mélange</button>
            
            ${stats.questionsWithErrors > 0 ? `
                <button class="restart-btn" onclick="restartErrorQuestions()" style="margin-left: 10px; background: linear-gradient(135deg, #ef4444, #f87171);">
                    ❌ Réviser les questions fausses
                </button>
            ` : ''}
        </div>
    `;
    validateBtn.style.display = 'none';
    clearMessage();
}

// Redémarrage du QCM
function restartQCM() {
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
}

// Redémarrage avec mélange
function restartWithShuffle() {
    questionOrder = shuffleArray(originalOrder);
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    showMessage('🔀 Questions mélangées pour ce nouveau QCM !', 'info');
    setTimeout(clearMessage, 2000);
}

// Révision des questions marquées comme fausses
function restartErrorQuestions() {
    const errorQuestionIndices = Object.keys(errorTracking).map(id => parseInt(id));
    
    if (errorQuestionIndices.length === 0) {
        showMessage('Aucune question marquée comme fausse à réviser !', 'info');
        return;
    }
    
    // Créer un nouveau QCM avec seulement les questions fausses
    questionOrder = errorQuestionIndices;
    currentQuestionIndex = 0;
    selectedAnswers = [];
    visitedQuestions = new Set();
    
    // Réinitialiser le suivi d'erreurs pour cette session de révision
    const previousErrors = {...errorTracking};
    errorTracking = {};
    
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    
    showMessage(`🎯 Mode révision : ${errorQuestionIndices.length} question(s) à réviser !`, 'info');
    setTimeout(clearMessage, 3000);
}

// Event listeners
validateBtn.addEventListener('click', validateAnswer);

// Event listener pour le bouton scroll to top
scrollToTopBtn.addEventListener('click', scrollToTop);

// Event listener pour le scroll
window.addEventListener('scroll', handleScrollToTopVisibility);

// Gestion du clic sur les options
document.addEventListener('click', function(e) {
    // Si on clique sur une option mais pas directement sur la checkbox
    if (e.target.closest('.option') && e.target.type !== 'checkbox') {
        const option = e.target.closest('.option');
        const optionNumber = parseInt(option.getAttribute('data-option'));
        toggleOption(optionNumber);
    }
});

// Initialisation au chargement de la page
window.addEventListener('load', function() {
    loadQCMData();
    handleScrollToTopVisibility(); // Vérifier l'état initial du scroll
});

// Fonction pour basculer l'état du navigateur
function toggleNavigator() {
    const navigator = document.getElementById('question-navigator');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (!navigator || !toggleIcon) {
        console.error('Éléments du navigateur non trouvés');
        return;
    }
    
    navigatorExpanded = !navigatorExpanded;
    
    if (navigatorExpanded) {
        navigator.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        navigator.classList.add('collapsed');
        toggleIcon.textContent = '▲';
    }
    
    // Sauvegarder l'état dans le localStorage
    localStorage.setItem('navigatorExpanded', navigatorExpanded.toString());
}

// Fonction pour restaurer l'état du navigateur depuis le localStorage
function restoreNavigatorState() {
    const navigator = document.getElementById('question-navigator');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (!navigator || !toggleIcon) {
        return;
    }
    
    const savedState = localStorage.getItem('navigatorExpanded');
    if (savedState !== null) {
        navigatorExpanded = savedState === 'true';
    } else {
        navigatorExpanded = true; // État par défaut
    }
    
    if (navigatorExpanded) {
        navigator.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        navigator.classList.add('collapsed');
        toggleIcon.textContent = '▲';
    }
}