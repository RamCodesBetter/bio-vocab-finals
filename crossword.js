// ===== Crossword Puzzle Generator =====

class CrosswordPuzzle {
    constructor(vocabulary) {
        this.vocabulary = vocabulary;
        this.grid = [];
        this.gridSize = 50; // Larger grid for more words
        this.placedWords = [];
        this.currentClue = null;
        this.currentDirection = 'across';
        this.timer = null;
        this.seconds = 0;
        this.isPaused = false;
        this.hintsUsed = 0;
        this.mode = '25';

        this.init();
    }

    init() {
        this.bindEvents();
        this.generatePuzzle();
    }

    bindEvents() {
        // Mode buttons
        document.getElementById('mode-25').addEventListener('click', () => this.setMode('25'));
        document.getElementById('mode-all').addEventListener('click', () => this.setMode('all'));

        // Action buttons
        document.getElementById('new-puzzle').addEventListener('click', () => this.generatePuzzle());
        document.getElementById('check-all').addEventListener('click', () => this.checkAllAnswers());
        document.getElementById('reveal-all').addEventListener('click', () => this.revealAllAnswers());

        // Timer toggle
        document.getElementById('timer-toggle').addEventListener('click', () => this.toggleTimer());

        // Clue tabs
        document.querySelectorAll('.clue-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchClueTab(e.target.dataset.direction));
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => this.closeHintModal());
        document.getElementById('hint-letter').addEventListener('click', () => this.revealFirstLetter());
        document.getElementById('hint-word').addEventListener('click', () => this.revealWord());

        // Success modal
        document.getElementById('play-again').addEventListener('click', () => {
            this.closeSuccessModal();
            this.generatePuzzle();
        });

        // Click outside modal to close
        document.getElementById('hint-modal').addEventListener('click', (e) => {
            if (e.target.id === 'hint-modal') this.closeHintModal();
        });
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        this.generatePuzzle();
    }

    getWordsForPuzzle() {
        // Filter words that are suitable for crossword (no spaces, reasonable length)
        let words = this.vocabulary.filter(item => {
            const term = item.term.replace(/[^a-zA-Z]/g, '');
            return term.length >= 3 && term.length <= 15;
        }).map(item => ({
            ...item,
            cleanTerm: item.term.replace(/[^a-zA-Z]/g, '').toUpperCase()
        }));

        // Shuffle words
        words = this.shuffleArray(words);

        // Return based on mode
        if (this.mode === '25') {
            return words.slice(0, 25);
        }
        return words;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    generatePuzzle() {
        // Show loading
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('crossword-grid').innerHTML = '';

        // Reset state
        this.placedWords = [];
        this.hintsUsed = 0;
        this.resetTimer();

        // Get words and generate
        setTimeout(() => {
            const words = this.getWordsForPuzzle();
            this.createGrid();
            this.placeWords(words);
            this.renderGrid();
            this.renderClues();
            this.updateProgress();
            this.startTimer();

            document.getElementById('loading').classList.add('hidden');
        }, 100);
    }

    createGrid() {
        this.grid = [];
        for (let i = 0; i < this.gridSize; i++) {
            this.grid.push(new Array(this.gridSize).fill(null));
        }
    }

    placeWords(words) {
        // Fully shuffle words for completely random placement
        const shuffledWords = this.shuffleArray([...words]);
        const unplacedWords = [];

        // Pick a random first word (not necessarily the longest)
        if (shuffledWords.length > 0) {
            const firstWord = shuffledWords[0];
            // Random starting position within the grid
            const direction = Math.random() < 0.5 ? 'across' : 'down';
            const maxRow = direction === 'down' ? this.gridSize - firstWord.cleanTerm.length - 5 : this.gridSize - 5;
            const maxCol = direction === 'across' ? this.gridSize - firstWord.cleanTerm.length - 5 : this.gridSize - 5;
            const startRow = Math.floor(Math.random() * (maxRow - 10)) + 5;
            const startCol = Math.floor(Math.random() * (maxCol - 10)) + 5;
            this.placeWord(firstWord, startRow, startCol, direction);
        }

        // Shuffle remaining words and try to place with intersections
        const remainingWords = this.shuffleArray(shuffledWords.slice(1));
        for (const word of remainingWords) {
            if (!this.findAndPlaceWord(word)) {
                unplacedWords.push(word);
            }
        }

        // Shuffle and retry unplaced words
        const shuffledUnplaced = this.shuffleArray(unplacedWords);
        const stillUnplaced = [];
        for (const word of shuffledUnplaced) {
            if (!this.findAndPlaceWord(word)) {
                stillUnplaced.push(word);
            }
        }

        // Place remaining words in empty areas
        for (const word of this.shuffleArray(stillUnplaced)) {
            this.placeWordInEmptyArea(word);
        }
    }

    findAndPlaceWord(wordObj) {
        const word = wordObj.cleanTerm;
        let bestPlacement = null;
        let maxScore = -1;

        // Try to find intersections with existing words
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col]) {
                    const letter = this.grid[row][col].letter;

                    // Check each position in the word for this letter
                    for (let i = 0; i < word.length; i++) {
                        if (word[i] === letter) {
                            // Try placing horizontally
                            const acrossCol = col - i;
                            if (this.canPlaceWord(word, row, acrossCol, 'across')) {
                                const score = this.scorePlacement(word, row, acrossCol, 'across');
                                if (score > maxScore) {
                                    maxScore = score;
                                    bestPlacement = { row, col: acrossCol, direction: 'across' };
                                }
                            }

                            // Try placing vertically
                            const downRow = row - i;
                            if (this.canPlaceWord(word, downRow, col, 'down')) {
                                const score = this.scorePlacement(word, downRow, col, 'down');
                                if (score > maxScore) {
                                    maxScore = score;
                                    bestPlacement = { row: downRow, col, direction: 'down' };
                                }
                            }
                        }
                    }
                }
            }
        }

        if (bestPlacement) {
            this.placeWord(wordObj, bestPlacement.row, bestPlacement.col, bestPlacement.direction);
            return true;
        }

        return false;
    }

    placeWordInEmptyArea(wordObj) {
        const word = wordObj.cleanTerm;

        // Find the bounds of existing words
        let minRow = this.gridSize, maxRow = 0, minCol = this.gridSize, maxCol = 0;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col]) {
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                }
            }
        }

        // Try to place near existing words
        const directions = ['across', 'down'];
        const offsets = [
            { dr: -3, dc: 0 },
            { dr: 3, dc: 0 },
            { dr: 0, dc: -3 },
            { dr: 0, dc: 3 },
        ];

        for (const dir of directions) {
            for (const offset of offsets) {
                const testRow = Math.floor((minRow + maxRow) / 2) + offset.dr;
                const testCol = Math.floor((minCol + maxCol) / 2) + offset.dc;

                for (let r = testRow - 10; r < testRow + 10; r++) {
                    for (let c = testCol - 10; c < testCol + 10; c++) {
                        if (this.canPlaceWord(word, r, c, dir)) {
                            this.placeWord(wordObj, r, c, dir);
                            return true;
                        }
                    }
                }
            }
        }

        // Last resort: find any valid position
        for (let row = 2; row < this.gridSize - 2; row += 2) {
            for (let col = 2; col < this.gridSize - 2; col += 2) {
                for (const dir of directions) {
                    if (this.canPlaceWord(word, row, col, dir)) {
                        this.placeWord(wordObj, row, col, dir);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    canPlaceWord(word, startRow, startCol, direction) {
        const dRow = direction === 'down' ? 1 : 0;
        const dCol = direction === 'across' ? 1 : 0;

        const endRow = startRow + (direction === 'down' ? word.length - 1 : 0);
        const endCol = startCol + (direction === 'across' ? word.length - 1 : 0);

        if (startRow < 1 || startCol < 1 || endRow >= this.gridSize - 1 || endCol >= this.gridSize - 1) {
            return false;
        }

        // Check cell before word start
        const beforeRow = startRow - dRow;
        const beforeCol = startCol - dCol;
        if (this.grid[beforeRow] && this.grid[beforeRow][beforeCol]) {
            return false;
        }

        // Check cell after word end
        const afterRow = endRow + dRow;
        const afterCol = endCol + dCol;
        if (this.grid[afterRow] && this.grid[afterRow][afterCol]) {
            return false;
        }

        let hasIntersection = false;

        // Check each cell
        for (let i = 0; i < word.length; i++) {
            const row = startRow + i * dRow;
            const col = startCol + i * dCol;
            const cell = this.grid[row][col];

            if (cell) {
                if (cell.letter !== word[i]) {
                    return false;
                }
                hasIntersection = true;
            } else {
                // Check perpendicular neighbors for non-intersection cells
                if (direction === 'across') {
                    if ((row > 0 && this.grid[row - 1][col]) || (row < this.gridSize - 1 && this.grid[row + 1][col])) {
                        return false;
                    }
                } else {
                    if ((col > 0 && this.grid[row][col - 1]) || (col < this.gridSize - 1 && this.grid[row][col + 1])) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    scorePlacement(word, startRow, startCol, direction) {
        const dRow = direction === 'down' ? 1 : 0;
        const dCol = direction === 'across' ? 1 : 0;
        let score = 0;

        for (let i = 0; i < word.length; i++) {
            const row = startRow + i * dRow;
            const col = startCol + i * dCol;
            if (this.grid[row][col] && this.grid[row][col].letter === word[i]) {
                score += 10;
            }
        }

        const centerRow = this.gridSize / 2;
        const centerCol = this.gridSize / 2;
        const distFromCenter = Math.abs(startRow - centerRow) + Math.abs(startCol - centerCol);
        score -= distFromCenter * 0.1;

        return score;
    }

    placeWord(wordObj, startRow, startCol, direction) {
        const word = wordObj.cleanTerm;
        const dRow = direction === 'down' ? 1 : 0;
        const dCol = direction === 'across' ? 1 : 0;

        const clueNumber = this.getNextClueNumber(startRow, startCol);

        const placedWord = {
            ...wordObj,
            startRow,
            startCol,
            direction,
            clueNumber,
            cells: []
        };

        for (let i = 0; i < word.length; i++) {
            const row = startRow + i * dRow;
            const col = startCol + i * dCol;

            if (!this.grid[row][col]) {
                this.grid[row][col] = {
                    letter: word[i],
                    clueNumbers: [],
                    wordIds: []
                };
            }

            this.grid[row][col].wordIds.push(this.placedWords.length);
            if (i === 0) {
                this.grid[row][col].clueNumbers.push(clueNumber);
            }

            placedWord.cells.push({ row, col });
        }

        this.placedWords.push(placedWord);
    }

    getNextClueNumber(row, col) {
        for (const word of this.placedWords) {
            if (word.startRow === row && word.startCol === col) {
                return word.clueNumber;
            }
        }

        const usedNumbers = new Set(this.placedWords.map(w => w.clueNumber));
        let num = 1;
        while (usedNumbers.has(num)) num++;
        return num;
    }

    renderGrid() {
        const gridElement = document.getElementById('crossword-grid');
        gridElement.innerHTML = '';

        let minRow = this.gridSize, maxRow = 0, minCol = this.gridSize, maxCol = 0;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col]) {
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                }
            }
        }

        minRow = Math.max(0, minRow - 1);
        maxRow = Math.min(this.gridSize - 1, maxRow + 1);
        minCol = Math.max(0, minCol - 1);
        maxCol = Math.min(this.gridSize - 1, maxCol + 1);

        const rows = maxRow - minRow + 1;
        const cols = maxCol - minCol + 1;

        gridElement.style.gridTemplateColumns = 'repeat(' + cols + ', 30px)';
        gridElement.style.gridTemplateRows = 'repeat(' + rows + ', 30px)';

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                if (this.grid[row][col]) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'cell-input';
                    input.maxLength = 1;
                    input.dataset.row = row;
                    input.dataset.col = col;
                    input.dataset.answer = this.grid[row][col].letter;

                    input.addEventListener('input', (e) => this.handleInput(e));
                    input.addEventListener('keydown', (e) => this.handleKeydown(e));
                    input.addEventListener('focus', (e) => this.handleFocus(e));
                    input.addEventListener('blur', (e) => this.handleBlur(e));

                    cell.appendChild(input);

                    if (this.grid[row][col].clueNumbers.length > 0) {
                        const numberSpan = document.createElement('span');
                        numberSpan.className = 'cell-number';
                        numberSpan.textContent = Math.min(...this.grid[row][col].clueNumbers);
                        cell.appendChild(numberSpan);
                    }
                } else {
                    cell.classList.add('black');
                }

                gridElement.appendChild(cell);
            }
        }
    }

    renderClues() {
        const acrossList = document.getElementById('clues-across');
        const downList = document.getElementById('clues-down');

        acrossList.innerHTML = '';
        downList.innerHTML = '';

        const acrossWords = this.placedWords.filter(w => w.direction === 'across').sort((a, b) => a.clueNumber - b.clueNumber);
        const downWords = this.placedWords.filter(w => w.direction === 'down').sort((a, b) => a.clueNumber - b.clueNumber);

        acrossWords.forEach(word => {
            acrossList.appendChild(this.createClueElement(word));
        });

        downWords.forEach(word => {
            downList.appendChild(this.createClueElement(word));
        });
    }

    createClueElement(word) {
        const clue = document.createElement('div');
        clue.className = 'clue-item';
        clue.dataset.wordId = this.placedWords.indexOf(word);
        clue.dataset.direction = word.direction;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'clue-number';
        numberSpan.textContent = word.clueNumber + '.';

        const textSpan = document.createElement('span');
        textSpan.className = 'clue-text';
        textSpan.textContent = word.definition + ' (' + word.cleanTerm.length + ')';

        const hintBtn = document.createElement('button');
        hintBtn.className = 'clue-hint-btn';
        hintBtn.textContent = 'Hint';

        clue.appendChild(numberSpan);
        clue.appendChild(textSpan);
        clue.appendChild(hintBtn);

        clue.addEventListener('click', (e) => {
            if (!e.target.classList.contains('clue-hint-btn')) {
                this.focusWord(word);
            }
        });

        hintBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showHintModal(word);
        });

        return clue;
    }

    focusWord(word) {
        this.currentClue = word;
        this.currentDirection = word.direction;

        document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('highlighted'));
        document.querySelectorAll('.clue-item').forEach(clue => clue.classList.remove('active'));

        word.cells.forEach(function (cellData) {
            const cell = document.querySelector('.cell[data-row="' + cellData.row + '"][data-col="' + cellData.col + '"]');
            if (cell) cell.classList.add('highlighted');
        });

        // Switch tab first
        this.switchClueTab(word.direction);

        const clueElement = document.querySelector('.clue-item[data-word-id="' + this.placedWords.indexOf(word) + '"]');
        if (clueElement) {
            clueElement.classList.add('active');
            // Scroll within the clues list only
            const cluesList = document.getElementById('clues-' + word.direction);
            if (cluesList) {
                cluesList.scrollTop = clueElement.offsetTop - cluesList.offsetTop - 20;
            }
        }

        const firstEmptyCell = word.cells.find(function (cellData) {
            const input = document.querySelector('.cell-input[data-row="' + cellData.row + '"][data-col="' + cellData.col + '"]');
            return input && !input.value;
        });

        const targetCell = firstEmptyCell || word.cells[0];
        const input = document.querySelector('.cell-input[data-row="' + targetCell.row + '"][data-col="' + targetCell.col + '"]');
        if (input) input.focus();
    }

    handleInput(e) {
        const input = e.target;
        const value = input.value.toUpperCase().slice(-1);
        input.value = value;

        if (value) {
            this.moveToNextCell(input);
        }

        this.updateProgress();
    }

    handleKeydown(e) {
        const input = e.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);

        switch (e.key) {
            case 'Backspace':
                e.preventDefault();
                input.value = '';
                this.moveToPrevCell(input);
                this.updateProgress();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.moveToAdjacentCell(row, col, 0, 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.moveToAdjacentCell(row, col, 0, -1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.moveToAdjacentCell(row, col, 1, 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveToAdjacentCell(row, col, -1, 0);
                break;
            case 'Tab':
                e.preventDefault();
                this.moveToNextWord(e.shiftKey);
                break;
        }
    }

    handleFocus(e) {
        const input = e.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);

        // Select existing text so typing replaces it
        input.select();

        const wordIds = this.grid[row][col].wordIds;
        if (wordIds.length > 0) {
            if (this.currentClue && this.currentClue.cells.some(c => c.row === row && c.col === col)) {
                // Keep current selection
            } else {
                this.focusWord(this.placedWords[wordIds[0]]);
            }
        }
    }

    handleBlur(e) {
        // Optional
    }

    moveToNextCell(currentInput) {
        if (!this.currentClue) return;

        const currentRow = parseInt(currentInput.dataset.row);
        const currentCol = parseInt(currentInput.dataset.col);
        const cellIndex = this.currentClue.cells.findIndex(c => c.row === currentRow && c.col === currentCol);

        if (cellIndex < this.currentClue.cells.length - 1) {
            const nextCell = this.currentClue.cells[cellIndex + 1];
            const nextInput = document.querySelector('.cell-input[data-row="' + nextCell.row + '"][data-col="' + nextCell.col + '"]');
            if (nextInput) nextInput.focus();
        }
    }

    moveToPrevCell(currentInput) {
        if (!this.currentClue) return;

        const currentRow = parseInt(currentInput.dataset.row);
        const currentCol = parseInt(currentInput.dataset.col);
        const cellIndex = this.currentClue.cells.findIndex(c => c.row === currentRow && c.col === currentCol);

        if (cellIndex > 0) {
            const prevCell = this.currentClue.cells[cellIndex - 1];
            const prevInput = document.querySelector('.cell-input[data-row="' + prevCell.row + '"][data-col="' + prevCell.col + '"]');
            if (prevInput) {
                prevInput.focus();
                prevInput.select();
            }
        }
    }

    moveToAdjacentCell(row, col, dRow, dCol) {
        const newRow = row + dRow;
        const newCol = col + dCol;
        const input = document.querySelector('.cell-input[data-row="' + newRow + '"][data-col="' + newCol + '"]');
        if (input) input.focus();
    }

    moveToNextWord(reverse) {
        if (!this.currentClue) return;

        const sameDirection = this.placedWords.filter(w => w.direction === this.currentDirection);
        const currentInDirection = sameDirection.indexOf(this.currentClue);

        let nextIndex;
        if (reverse) {
            nextIndex = (currentInDirection - 1 + sameDirection.length) % sameDirection.length;
        } else {
            nextIndex = (currentInDirection + 1) % sameDirection.length;
        }

        this.focusWord(sameDirection[nextIndex]);
    }

    switchClueTab(direction) {
        document.querySelectorAll('.clue-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.direction === direction);
        });

        document.getElementById('clues-across').classList.toggle('hidden', direction !== 'across');
        document.getElementById('clues-down').classList.toggle('hidden', direction !== 'down');
    }

    checkAllAnswers() {
        const inputs = document.querySelectorAll('.cell-input');
        inputs.forEach(input => {
            const cell = input.parentElement;
            const answer = input.dataset.answer;
            const value = input.value.toUpperCase();

            cell.classList.remove('correct', 'incorrect');

            if (value) {
                if (value === answer) {
                    cell.classList.add('correct');
                } else {
                    cell.classList.add('incorrect');
                }
            }
        });

        this.updateClueCompletion();
    }

    revealAllAnswers() {
        const inputs = document.querySelectorAll('.cell-input');
        inputs.forEach(input => {
            input.value = input.dataset.answer;
            input.parentElement.classList.add('revealed');
        });

        this.updateProgress();
        this.updateClueCompletion();
    }

    updateClueCompletion() {
        const self = this;
        this.placedWords.forEach(function (word, index) {
            const isComplete = word.cells.every(function (cellData) {
                const input = document.querySelector('.cell-input[data-row="' + cellData.row + '"][data-col="' + cellData.col + '"]');
                return input && input.value.toUpperCase() === self.grid[cellData.row][cellData.col].letter;
            });

            const clueElement = document.querySelector('.clue-item[data-word-id="' + index + '"]');
            if (clueElement) {
                clueElement.classList.toggle('completed', isComplete);
            }
        });
    }

    updateProgress() {
        const inputs = document.querySelectorAll('.cell-input');
        const totalCells = inputs.length;

        let filledCells = 0;
        inputs.forEach(input => {
            if (input.value) {
                filledCells++;
            }
        });

        document.getElementById('progress-text').textContent = filledCells + ' / ' + totalCells;
    }

    checkCompletion() {
        const inputs = document.querySelectorAll('.cell-input');
        let allCorrect = true;

        inputs.forEach(input => {
            if (input.value.toUpperCase() !== input.dataset.answer) {
                allCorrect = false;
            }
        });

        if (allCorrect && this.placedWords.length > 0) {
            this.showSuccessModal();
        }
    }

    // Timer functions
    startTimer() {
        this.seconds = 0;
        this.isPaused = false;
        this.updateTimerDisplay();

        if (this.timer) clearInterval(this.timer);
        const self = this;
        this.timer = setInterval(function () {
            if (!self.isPaused) {
                self.seconds++;
                self.updateTimerDisplay();
            }
        }, 1000);

        document.getElementById('timer-toggle').textContent = '⏸️';
    }

    resetTimer() {
        if (this.timer) clearInterval(this.timer);
        this.seconds = 0;
        this.isPaused = false;
        this.updateTimerDisplay();
    }

    toggleTimer() {
        this.isPaused = !this.isPaused;
        document.getElementById('timer-toggle').textContent = this.isPaused ? '▶️' : '⏸️';
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.seconds / 60);
        const secs = this.seconds % 60;
        const display = (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
        document.getElementById('timer-display').textContent = display;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Hint functions
    showHintModal(word) {
        this.hintWord = word;
        document.getElementById('hint-clue-text').textContent = word.definition;
        document.getElementById('hint-modal').classList.add('active');
    }

    closeHintModal() {
        document.getElementById('hint-modal').classList.remove('active');
        this.hintWord = null;
    }

    revealFirstLetter() {
        if (!this.hintWord) return;

        const firstCell = this.hintWord.cells[0];
        const input = document.querySelector('.cell-input[data-row="' + firstCell.row + '"][data-col="' + firstCell.col + '"]');
        if (input) {
            input.value = this.grid[firstCell.row][firstCell.col].letter;
            input.parentElement.classList.add('revealed');
            this.hintsUsed++;
        }

        this.closeHintModal();
        this.updateProgress();
    }

    revealWord() {
        if (!this.hintWord) return;

        const self = this;
        this.hintWord.cells.forEach(function (cellData) {
            const input = document.querySelector('.cell-input[data-row="' + cellData.row + '"][data-col="' + cellData.col + '"]');
            if (input) {
                input.value = self.grid[cellData.row][cellData.col].letter;
                input.parentElement.classList.add('revealed');
            }
        });

        this.hintsUsed++;
        this.closeHintModal();
        this.updateProgress();
        this.updateClueCompletion();
        this.checkCompletion();
    }

    // Success modal
    showSuccessModal() {
        if (this.timer) clearInterval(this.timer);

        document.getElementById('final-time').textContent = this.formatTime(this.seconds);
        document.getElementById('final-words').textContent = this.placedWords.length;
        document.getElementById('final-hints').textContent = this.hintsUsed;
        document.getElementById('success-modal').classList.add('active');
    }

    closeSuccessModal() {
        document.getElementById('success-modal').classList.remove('active');
    }
}

// Initialize the puzzle when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    new CrosswordPuzzle(vocabularyData);
});
