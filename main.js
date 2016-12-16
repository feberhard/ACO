/*
 * //==============================================\\
 * || Project: Ant Colony Optimization             ||
 * || Authors: Eberhard Felix, Dorfeister Daniel,  ||
 * ||          De Rosis Alessandro                 ||
 * || Date:    05.12.2016                          ||
 * \\==============================================//
 */
// start vs-code task: ctrl+shift+b
// variables
var fieldWidth = 5;
var fieldHeight = 5;
var pixelSize = 100;
var field;
var randomField;
var randomNeighbour;
var colorArray;
var canvas;
var ctx;
var default_config = {
    // colors
    groundColor: "#A08556",
    foodColor: "#246D25",
    antToFoodColor: "#000000",
    antToNestColor: "#CCCC00",
    nestColor: "#FF0000",
    // ant
    antPopulation: 1,
    initialPheremoneStrength: 200,
    // food
    foodSources: 1,
    // nest
    nestSources: 1,
    // cell
    maxPheromone: 200,
    // general
    fps: 100,
    maxCellSize: 1,
};
var config = default_config;
class Cell {
    constructor(col, row, food = false, nest = false) {
        this.col = col;
        this.row = row;
        this.food = food;
        this.nest = nest;
        this.toNestPheromone = 0;
        this.toFoodPheromone = 0;
    }
    get color() {
        if (this.nest) {
            return config.nestColor;
        }
        var antCount = this.ant != null ? 1 : 0;
        var foodCount = this.food ? 1 : 0;
        var antDirection = this.ant != null ? this.ant.direction : 0;
        return colorArray[antCount][foodCount][antDirection];
    }
    canAddAnt() {
        return this.ant == null;
    }
    addAnt(ant) {
        if (this.canAddAnt()) {
            this.ant = ant;
            return true;
        }
        return false;
    }
    addFood() {
        this.food = true;
    }
    setNest() {
        this.nest = true;
    }
    setMoved(moved) {
        if (this.ant != null) {
            this.ant.moved = moved;
        }
    }
    decreasePheromone() {
        this.toFoodPheromone = Math.max(this.toFoodPheromone - 1, 0);
        this.toNestPheromone = Math.max(this.toNestPheromone - 1, 0);
    }
    // public addPheromone(pheromone: number) {
    //     this.pheromone = Math.min(this.pheromone + pheromone, config.maxPheromone);
    // }
    addtoNestPheromone(pheromone) {
        this.toNestPheromone = Math.min(this.toNestPheromone + pheromone, config.maxPheromone);
    }
    addToFoodPheromone(pheromone) {
        this.toFoodPheromone = Math.min(this.toFoodPheromone + pheromone, config.maxPheromone);
    }
}
class Ant {
    constructor(pheromoneStrength) {
        this.direction = 0 /* toFood */;
        this.pheromoneStrength = pheromoneStrength;
    }
    decreasePheromoneStrength() {
        this.pheromoneStrength = Math.max(this.pheromoneStrength - 2, 0);
    }
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
    colorArray = new Array(maxAnts + 1);
    for (var i = 0; i < maxAnts + 1; i++) {
        colorArray[i] = new Array(maxFood + 1);
        var antPercent = i / maxAnts;
        for (var j = 0; j < maxFood + 1; j++) {
            colorArray[i][j] = new Array(2);
            var foodPercent = j / maxFood;
            // antColor * antPercent blended with foodColor * foodPercent
            // e.g. 
            // 1) 1 ant, 0 food (max 1 ant per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ant per cell, max 2 food per cell) => 25% antColor blended with 50% foodColor
            var antFoodColorToFood = shadeBlendConvert(antPercent + foodPercent > 0 ? antPercent / (antPercent + foodPercent) : 0, config.foodColor, config.antToFoodColor);
            var antFoodColorToNest = shadeBlendConvert(antPercent + foodPercent > 0 ? antPercent / (antPercent + foodPercent) : 0, config.foodColor, config.antToNestColor);
            // blend antFoodColor with groundColor
            // e.g.
            // 1) 1 ant, 0 food (max 1 ant per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ant per cell, max 2 food per cell) => 75% antFoodColor blended with 25% groundColor
            var cellColorToFood = shadeBlendConvert(Math.min(antPercent + foodPercent, 1), config.groundColor, antFoodColorToFood);
            var cellColorToNest = shadeBlendConvert(Math.min(antPercent + foodPercent, 1), config.groundColor, antFoodColorToNest);
            colorArray[i][j][0 /* toFood */] = cellColorToFood;
            colorArray[i][j][1 /* toNest */] = cellColorToNest;
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
    canvas = document.getElementById("my-canvas");
    ctx = canvas.getContext("2d");
    canvas.width = fieldWidth * pixelSize;
    canvas.height = fieldHeight * pixelSize;
    initColors();
}
function initRandomValues(field) {
    field[2][2].addAnt(new Ant(config.initialPheremoneStrength));
    // field[2][1].addAnt(new Ant(config.initialPheremoneStrength));
    // field[2][0].addAnt(new Ant(config.initialPheremoneStrength));
    field[0][0].addFood();
    field[3][3].setNest();
    // for (var i = 0; i < config.antPopulation; i++) {
    //     var x = Math.floor(Math.random() * fieldWidth);
    //     var y = Math.floor(Math.random() * fieldHeight);
    //     field[x][y].addAnt(new Ant());
    // }
    // for (var i = 0; i < config.foodSources; i++) {
    //     var x = Math.floor(Math.random() * fieldWidth);
    //     var y = Math.floor(Math.random() * fieldHeight);
    //     field[x][y].addFood();
    // }
    // for (var i = 0; i < config.nestSources; i++) {
    //     var x = Math.floor(Math.random() * fieldWidth);
    //     var y = Math.floor(Math.random() * fieldHeight);
    //     field[x][y].setNest();
    // }
}
function randomizeArray(field) {
    // Fisher-Yates shuffle https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    for (var i = 0; i < field.length; i++) {
        var j = Math.round(Math.random() * i);
        var temp = field[i];
        field[i] = field[j];
        field[j] = temp;
    }
    return field;
}
function getCellScoreAnt(cell, ant) {
    if (!cell.canAddAnt())
        return -1;
    if (ant.direction === 1 /* toNest */) {
        if (cell.nest) {
            return Number.MAX_VALUE;
        }
        return cell.toNestPheromone;
    }
    else {
        if (cell.food) {
            return Number.MAX_VALUE;
        }
        return cell.toFoodPheromone;
    }
}
// get best neighbouring cell for the ant to move (can also be the cell he is currently in)
function getBestCell(field, x, y, ant, scoreFunction) {
    //     0 1 2
    //     _____
    // 0 | 0 1 2
    // 1 | 3 4 5
    // 2 | 6 7 8
    var neighbourCells = [1, 3, 5, 7]; // top, left, right, bottom
    neighbourCells = randomizeArray(neighbourCells);
    // var neighbours = [field[x][y]];
    // var neighbourScores = [scoreFunction(field[x][y], ant)];
    var neighbours = [];
    var neighbourScores = [];
    for (var i = 0; i < neighbourCells.length; i++) {
        var n = neighbourCells[i];
        var nx = Math.floor(n / 3);
        var ny = n % 3;
        var rx = nx - 1 + x;
        var ry = ny - 1 + y;
        if (rx < 0 || rx >= fieldWidth || ry < 0 || ry >= fieldHeight) {
            continue;
        }
        var cell = field[rx][ry];
        var score = scoreFunction(cell, ant);
        neighbours.push(cell);
        neighbourScores.push(score);
    }
    neighbourScores.forEach((a, index) => neighbourScores[index] = a + 1);
    var scoreSum = neighbourScores.reduce((a, b) => a + b, 0);
    neighbourScores.forEach((a, index) => neighbourScores[index] = a / scoreSum);
    var random = Math.random();
    var selectedIndex;
    for (selectedIndex = 0; selectedIndex < neighbourScores.length; selectedIndex++) {
        random -= neighbourScores[selectedIndex];
        if (random <= 0) {
            break;
        }
    }
    return neighbours[selectedIndex];
}
function getBestCellAnt(field, x, y, ant) {
    return getBestCell(field, x, y, ant, this.getCellScoreAnt);
}
function transition(field, x, y) {
    var cell = field[x][y];
    if (cell.ant != null) {
        var ant = cell.ant;
        if (ant.moved === true) {
            return;
        }
        ant.moved = true;
        var bestCell = getBestCellAnt(field, x, y, ant);
        if (bestCell != cell) {
            if (bestCell.addAnt(ant)) {
                cell.ant = null; // remove from current cell;
                if (ant.direction === 0 /* toFood */) {
                    bestCell.addtoNestPheromone(ant.pheromoneStrength);
                }
                else {
                    bestCell.addToFoodPheromone(ant.pheromoneStrength);
                }
                ant.decreasePheromoneStrength();
                if (bestCell.food) {
                    ant.direction = 1 /* toNest */;
                    ant.pheromoneStrength = config.initialPheremoneStrength;
                }
                else if (bestCell.nest) {
                    ant.direction = 0 /* toFood */;
                    ant.pheromoneStrength = config.initialPheremoneStrength;
                }
            }
        }
    }
    // TODO transition
}
function updateField() {
    randomField = randomizeArray(randomField);
    for (var i = 0; i < randomField.length; i++) {
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
                field[i][j].decreasePheromone();
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
    ctx.font = pixelSize / 2 + "px Courier New";
    for (var i = 0; i < fieldWidth; i++) {
        for (var j = 0; j < fieldHeight; j++) {
            ctx.fillStyle = field[i][j].color;
            ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
            ctx.fillStyle = "#DDFFDD";
            ctx.fillText("" + field[i][j].toFoodPheromone, (i) * pixelSize, (j) * pixelSize + pixelSize);
            ctx.fillStyle = "#FFDDDD";
            ctx.fillText("" + field[i][j].toNestPheromone, (i) * pixelSize, (j) * pixelSize + 0.5 * pixelSize);
        }
    }
}
function getValueFromHMTLInput(id) {
    var input = document.getElementById(id);
    if (input == null)
        return null;
    if (input.type == "checkbox")
        return input.checked;
    else if (input.type == "number")
        return input.valueAsNumber;
    else
        return input.value;
}
function setHtmlInputValue(id, val) {
    var input = document.getElementById(id);
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
    config.fps = getValueFromHMTLInput('fps');
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
var startButton;
var pauseButton;
var resumeButton;
window.onload = function () {
    fillHtmlInputs();
    startButton = document.getElementById("btn-start-simulation");
    pauseButton = document.getElementById("btn-pause-simulation");
    resumeButton = document.getElementById("btn-resume-simulation");
};
//# sourceMappingURL=main.js.map