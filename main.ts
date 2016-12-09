/*
 * //==============================================\\
 * || Project: Ant Colony Optimization             ||
 * || Authors: Eberhard Felix, Dorfeister Daniel,  ||
 * ||          De Rossi Alessandro                 ||
 * || Date:    05.12.2016                          ||
 * \\==============================================// 
 */

// start vs-code task: ctrl+shift+b


// variables
var fieldWidth = 50;
var fieldHeight = 50;
var pixelSize = 10;
var field: Cell[][];
var randomField: number[];
var randomNeighbour: number[];
var colorArray: string[][];

var canvas: HTMLCanvasElement;
var ctx: CanvasRenderingContext2D;

var default_config = {
    // colors
    groundColor: "#A08556", // brown
    foodColor: "#246D25", // green
    antColor: "#000000", // black
    nestColor: "#FF0000", // red

    // ant
    antPopulation: 10,

    // food
    foodSources: 1,

    // general
    fps: 100,
    maxCellSize: 1, // max number of ants per cell
};

var config = default_config;

class Cell {
    public ant: Ant;
    // TODO possible more than 1 ant per cell
    // public ants: Ant[];
    // public maxAnts: number;

    // TODO possible two different pheromone: 1 for going to the food, 1 for going back
    public pheromone: number;

    // TODO probably make food a number which decreases every time an ant eats from it
    public food: boolean;

    get color(): string {
        var antCount = this.ant != null ? 1 : 0;
        var foodCount = this.food ? 1 : 0;
        return colorArray[antCount][foodCount];
    }

    constructor(public col: number, public row: number, food: boolean = false) {
        this.food = food;
    }

    public canAddAnt() {
        return this.ant == null;
    }

    public addAnt(ant: Ant) {
        if (this.canAddAnt()) {
            this.ant = ant;
            return true;
        }
        return false;
    }

    public addFood() {
        this.food = true;
    }

    public setMoved(moved: boolean) {
        if (this.ant != null) {
            this.ant.moved = moved
        }
    }
}

const enum Direction {
    toFood,
    fromFood
}

class Ant {
    public moved: boolean;
    public direction: Direction;
}

function initColors() {
    //               ant
    //           0 1 2 3 4 5
    //          ------------
    // food  0 | g         b
    //       1 | f
    // b = ground/brown, b = black, f = food/green

    var maxAnts = config.maxCellSize;
    var maxFood = 1;
    colorArray = new Array<string[]>(maxAnts + 1);
    for (var i = 0; i < maxAnts + 1; i++) {
        colorArray[i] = new Array<string>(maxFood + 1);

        var antPercent = i / maxAnts;
        for (var j = 0; j < maxFood + 1; j++) {
            var foodPercent = j / maxFood;
            // antColor * antPercent blended with foodColor * foodPercent
            // e.g. 
            // 1) 1 ant, 0 food (max 1 ant per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ant per cell, max 2 food per cell) => 25% antColor blended with 50% foodColor
            var antFoodColor = shadeBlendConvert(antPercent + foodPercent > 0 ? antPercent / (antPercent + foodPercent) : 0, config.foodColor, config.antColor);
            // blend antFoodColor with groundColor
            // e.g.
            // 1) 1 ant, 0 food (max 1 ant per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ant per cell, max 2 food per cell) => 75% antFoodColor blended with 25% groundColor
            var cellColor = shadeBlendConvert(Math.min(antPercent + foodPercent, 1), config.groundColor, antFoodColor);
            colorArray[i][j] = cellColor;

            // ctx.fillStyle = cellColor;
            // ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
        }
    }
}

var pauseFlag = false;
var startCount = 0; // increase after every press on start button to check if the current loop has to be canceled
function gameloop(currentStartCount) {
    setTimeout(function () {
        if (pauseFlag || currentStartCount != startCount) {
            return;
        }
        requestAnimationFrame(gameloop.bind(this, currentStartCount));

        updateField();

        drawClearField();
        drawField();
    }, 1000 / config.fps);
}

function init() {
    field = new Array(fieldWidth);

    for (var i = 0; i < fieldWidth; i++) {
        field[i] = new Array(fieldHeight);
        for (var j = 0; j < fieldHeight; j++) {
            field[i][j] = new Cell(i, j);
        }
    }

    randomField = new Array(fieldWidth * fieldHeight);
    for (var i = 0; i < fieldWidth * fieldHeight; i++) {
        randomField[i] = i;
    }
    //     0 1 2
    //     _____
    // 0 | 0 1 2
    // 1 | 3 4 5
    // 2 | 6 7 8
    randomNeighbour = [1, 3, 4, 5, 7];

    canvas = <HTMLCanvasElement>document.getElementById("my-canvas");
    ctx = canvas.getContext("2d");
    canvas.width = fieldWidth * pixelSize;
    canvas.height = fieldHeight * pixelSize;

    initColors();
}

function initRandomValues(field: Cell[][]) {
    for (var i = 0; i < config.antPopulation; i++) {
        var x = Math.floor(Math.random() * fieldWidth);
        var y = Math.floor(Math.random() * fieldHeight);

        field[x][y].addAnt(new Ant());
    }

    for (var i = 0; i < config.foodSources; i++) {
        var x = Math.floor(Math.random() * fieldWidth);
        var y = Math.floor(Math.random() * fieldHeight);

        field[x][y].addFood();
    }
}

function randomizeArray(field: any[]) {
    // Fisher-Yates shuffle https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    for (var i = 0; i < field.length; i++) {
        var j = Math.round(Math.random() * i);
        var temp = field[i];
        field[i] = field[j];
        field[j] = temp;
    }
    return field;
}

function getCellScoreAnt(cell: Cell) {
    if (!cell.canAddAnt()) // no room on cell
        return -1;

    // TODO calculate cell score
    return Math.random();
}

// get best neighbouring cell for the ant to move (can also be the cell he is currently in)
function getBestCell(field: Cell[][], x: number, y: number, scoreFunction: (cell: Cell) => number) {
    //     0 1 2
    //     _____
    // 0 | 0 1 2
    // 1 | 3 4 5
    // 2 | 6 7 8
    var neighbourCells = [1, 3, 5, 7]; // top, left, right, bottom

    var bestNeighbour = field[x][y];
    var bestScore = scoreFunction(bestNeighbour);

    for (var i = 0; i < neighbourCells.length; i++) {
        var n = neighbourCells[i];
        var nx = Math.floor(n / 3);
        var ny = n % 3;

        var rx = (nx - 1 + x + fieldWidth) % fieldWidth;
        var ry = (ny - 1 + y + fieldHeight) % fieldHeight;
        var cell = field[rx][ry];
        var score = scoreFunction(cell);
        if (score > bestScore || (score === bestScore && Math.random() > 0.5)) {
            bestScore = score;
            bestNeighbour = cell;
        }
    }
    return bestNeighbour;
}

function getBestCellAnt(field: Cell[][], x: number, y: number) {
    return getBestCell(field, x, y, this.getCellScoreAnt);
}

function transition(field: Cell[][], x: number, y: number) {
    var cell = field[x][y];

    if (cell.ant != null) {
        var ant = cell.ant;
        if (ant.moved === true) {
            return;
        }

        ant.moved = true;

        var bestCell = getBestCellAnt(field, x, y);
        if (bestCell != cell) { // move ant
            if (bestCell.addAnt(ant)) { // add to better cell
                cell.ant = null; // remove from current cell;
            }
        }
    }
    // TODO transition
}

function updateField() {
    randomField = randomizeArray(randomField);

    for (var i = 0; i < randomField.length; i++) { // iterate randomly over the field
        var n = randomField[i];
        var x = Math.floor(n / fieldWidth);
        var y = n % fieldWidth;

        transition(field, x, y);
    }

    // reset moved flag
    for (var i = 0; i < fieldWidth; i++) {
        for (var j = 0; j < fieldHeight; j++) {
            if (field[i][j] != null) {
                field[i][j].setMoved(false);
            }
        }
    }
}

function drawClearField() {
    // draw water
    ctx.fillStyle = config.groundColor;
    ctx.fillRect(0, 0, fieldWidth * pixelSize, fieldHeight * pixelSize);
}

function drawField() {
    for (var i = 0; i < fieldWidth; i++) {
        for (var j = 0; j < fieldHeight; j++) {
            ctx.fillStyle = field[i][j].color;

            ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
        }
    }
}

function getValueFromHMTLInput(id: string): boolean | number | string {
    var input: HTMLInputElement = <HTMLInputElement>document.getElementById(id);
    if (input == null)
        return null;

    if (input.type == "checkbox")
        return input.checked;
    else if (input.type == "number")
        return input.valueAsNumber;
    else
        return input.value;
}

function setHtmlInputValue(id: string, val) {
    var input: HTMLInputElement = <HTMLInputElement>document.getElementById(id);
    if (input != null) {
        if (input.type == "checkbox")
            input.checked = val == '1' ? true : false;
        else
            input.value = val;
    }
}

// fill the configuration inputs on the html page
function fillHtmlInputs() {
    Object.keys(config).forEach(function (key, index) {
        setHtmlInputValue(key, config[key]);
    });
}

function readConfigurationValues() {
    Object.keys(config).forEach(function (key, index) {
        var val = getValueFromHMTLInput(key);

        if (val != null) {
            config[key] = val;
        }
    });
}

function changeFps() {
    config.fps = <number>getValueFromHMTLInput('fps');
    setHtmlInputValue('fpsNumber', config.fps);
}

function restoreDefaultConfig() {
    config = default_config;
    fillHtmlInputs();
}

function startSimulation() {
    pauseFlag = false;
    readConfigurationValues();
    init();
    initRandomValues(field);
    startCount++;
    gameloop(startCount);

    startButton.value = "Restart simulation";
    pauseButton.style.display = "inline-block";
    resumeButton.style.display = "none";
}

function pauseSimulation() {
    pauseFlag = true;
    pauseButton.style.display = "none";
    resumeButton.style.display = "inline-block";
}

function resumeSimulation() {
    pauseFlag = false;
    pauseButton.style.display = "inline-block";
    resumeButton.style.display = "none";

    requestAnimationFrame(gameloop.bind(this, startCount));
}

var startButton: HTMLButtonElement;
var pauseButton: HTMLButtonElement;
var resumeButton: HTMLButtonElement;

window.onload = function () {
    fillHtmlInputs();

    startButton = <HTMLButtonElement>document.getElementById("btn-start-simulation");
    pauseButton = <HTMLButtonElement>document.getElementById("btn-pause-simulation");
    resumeButton = <HTMLButtonElement>document.getElementById("btn-resume-simulation");
};
