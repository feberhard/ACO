/*
 * //==============================================\\
 * || Project: Ant Colony Optimization             ||
 * || Authors: Eberhard Felix, Dorfmeister Daniel, ||
 * ||          De Rosis Alessandro Francesco       ||
 * || Date:    05.12.2016                          ||
 * \\==============================================//
 */
// start vs-code task: ctrl+shift+b
// variables
var pixelSize = 25;
var field;
var randomField;
var colorArray; // [ants][food][antDirection]
var canvas;
var ctx;
var default_config = {
    // colors
    groundColor: "#A08556",
    foodColor: "#00CC00",
    // foodColor: "#246D25", // green
    antToFoodColor: "#000000",
    antToNestColor: "#CCCC00",
    nestColor: "#DD0000",
    obstacleColor: "#0000FF",
    ToNestPheromoneColor: "#FFDDDD",
    ToFoodPheromoneColor: "#DDFFDD",
    // ant
    antPopulation: 20,
    initialPheromoneStrength: 300,
    // food
    foodSources: 1,
    maxFood: 200,
    minDistanceToNest: 1,
    // nest
    nests: 1,
    // cell
    maxPheromone: 300,
    maxAnts: 100,
    obstacles: 20,
    // general
    fps: 100,
    minimisationAlgorithmEnabled: false,
    minimisationSpreadValue: 1,
    minimisationSpreadPercentage: 0,
    fieldWidth: 20,
    fieldHeight: 20,
    canvasSize: 800,
    seperatePheromoneView: true,
};
var config = JSON.parse(JSON.stringify(default_config));
var default_statistics = {
    foodInSources: 0,
    foodInNests: 0,
    antsWithFood: 0,
};
var statistics = JSON.parse(JSON.stringify(default_statistics));
class Cell {
    constructor(col, row, maxAnts, food = 0, nest = false) {
        this.col = col;
        this.row = row;
        this.ants = [];
        this.maxAnts = maxAnts;
        this.food = food;
        this.nest = nest;
        this.toNestPheromone = 0;
        this.toFoodPheromone = 0;
    }
    get color() {
        if (this.maxAnts == 0) {
            return config.obstacleColor;
        }
        if (this.nest) {
            return config.nestColor;
        }
        var antCount = this.ants.length;
        var foodCount = this.food;
        var antDirection = this.ants.length > 0 ? this.ants[0].direction : 0;
        return colorArray[this.ants.length > 0 ? this.maxAnts : 0][foodCount][antDirection];
        // return colorArray[antCount][foodCount][antDirection];
    }
    canAddAnt() {
        return this.ants.length < this.maxAnts;
    }
    addAnt(ant) {
        if (this.canAddAnt()) {
            this.ants.push(ant);
            return true;
        }
        return false;
    }
    canAddObstacle() {
        return !this.nest && !this.food && this.maxAnts != 0;
    }
    addFood(food = config.maxFood) {
        this.food = Math.min(this.food + food, config.maxFood);
    }
    takeFood() {
        this.food = Math.max(this.food - 1, 0);
    }
    setNest() {
        this.nest = true;
    }
    setMoved(moved) {
        this.ants.forEach(a => a.moved = moved);
    }
    decreasePheromone() {
        this.toFoodPheromone = Math.max(this.toFoodPheromone - 1, 0);
        this.toNestPheromone = Math.max(this.toNestPheromone - 1, 0);
    }
    addtoNestPheromone(pheromone) {
        this.toNestPheromone = Math.min(this.toNestPheromone + pheromone, config.maxPheromone);
    }
    addToFoodPheromone(pheromone) {
        this.toFoodPheromone = Math.min(this.toFoodPheromone + pheromone, config.maxPheromone);
    }
}
class Ant {
    constructor(pheromoneStrength) {
        this.hasFood = false;
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
    // g = ground/brown, b = black, f = food/green
    var maxAnts = config.maxAnts;
    var maxFood = config.maxFood;
    colorArray = new Array(maxAnts + 1);
    for (var i = 0; i < maxAnts + 1; i++) {
        colorArray[i] = new Array(maxFood + 1);
        var antPercent = i / maxAnts;
        for (var j = 0; j < maxFood + 1; j++) {
            colorArray[i][j] = new Array(2);
            var foodBonus = j == 0 ? 0 : Math.ceil(maxFood * 0.2);
            var foodPercent = Math.min(j + foodBonus, maxFood) / maxFood; // increase visibility of food a bit
            // antColor * antPercent blended with foodColor * foodPercent
            // e.g. 
            // 1) 1 ant, 0 food (max 1 ants per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ants per cell, max 2 food per cell) => 25% antColor blended with 50% foodColor
            var antFoodColorToFood = shadeBlendConvert(antPercent + foodPercent > 0 ? antPercent / (antPercent + foodPercent) : 0, config.foodColor, config.antToFoodColor);
            var antFoodColorToNest = shadeBlendConvert(antPercent + foodPercent > 0 ? antPercent / (antPercent + foodPercent) : 0, config.foodColor, config.antToNestColor);
            // blend antFoodColor with groundColor
            // e.g.
            // 1) 1 ant, 0 food (max 1 ants per cell) => 100% antColor
            // 2) 1 ant, 1 food (max 4 ants per cell, max 2 food per cell) => 75% antFoodColor blended with 25% groundColor
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
        updateStatistics();
    }, 1000 / config.fps);
}
function updateStatistics() {
    setHtmlInputValue('antsWithoutFood', config.antPopulation * config.nests - statistics.antsWithFood);
    setHtmlInputValue('antsWithFood', statistics.antsWithFood);
    setHtmlInputValue('foodInSources', statistics.foodInSources);
    setHtmlInputValue('foodInNests', statistics.foodInNests);
}
function resetStatistics() {
    statistics = JSON.parse(JSON.stringify(default_statistics));
    statistics.foodInSources = config.foodSources * config.maxFood;
    updateStatistics();
}
function init() {
    pixelSize = Math.min(config.canvasSize / config.fieldWidth, config.canvasSize / config.fieldHeight);
    canvas = document.getElementById("my-canvas");
    ctx = canvas.getContext("2d");
    canvas.width = config.fieldWidth * pixelSize;
    canvas.height = config.fieldHeight * pixelSize;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    field = new Array(config.fieldWidth);
    for (var i = 0; i < config.fieldWidth; i++) {
        field[i] = new Array(config.fieldHeight);
        for (var j = 0; j < config.fieldHeight; j++) {
            field[i][j] = new Cell(i, j, config.maxAnts);
        }
    }
    randomField = new Array(config.fieldWidth * config.fieldHeight);
    for (var i = 0; i < config.fieldWidth * config.fieldHeight; i++) {
        randomField[i] = i;
    }
    initColors();
}
// function initRandomValues(field: Cell[][]) {
//     for (var i = 0; i < config.obstacles; i++) {
//         var x = Math.floor(Math.random() * fieldWidth);
//         var y = Math.floor(Math.random() * fieldHeight);
//         field[x][y].maxAnts = 0;
//     }
//     // for (var i = 2; i < fieldWidth - 5; i++) {
//     //     var x = i;
//     //     var y = fieldHeight - i;
//     //     field[x][y].maxAnts = 0;
//     //     field[x][y+1].maxAnts = 0;
//     // }
//     field[Math.round(fieldWidth / 4)][Math.round(fieldWidth / 4)].addFood();
//     field[Math.round(fieldWidth / 4)][Math.round(fieldWidth / 4)].maxAnts = config.maxAnts;
//     field[fieldWidth - Math.round(fieldWidth / 4)][fieldHeight - Math.round(fieldWidth / 4)].setNest();
//     field[fieldWidth - Math.round(fieldWidth / 4)][fieldHeight - Math.round(fieldWidth / 4)].maxAnts = config.maxAnts;
//     for (var i = 0; i < config.antPopulation; i++) {
//         field[fieldWidth - Math.round(fieldWidth / 4)][fieldHeight - Math.round(fieldWidth / 4)].addAnt(new Ant(config.initialPheromoneStrength));
//     }
// }
function calcMinDistance(foodSource, nests) {
    var minDistance = Number.MAX_VALUE;
    nests.forEach(function (nest) {
        minDistance = Math.min(minDistance, 
        // Manhattan distance
        Math.abs(foodSource[0] - nest[0]) + Math.abs(foodSource[1] - nest[1]));
    });
    return minDistance;
}
function initRandomValues(field) {
    const maxDistanceToNest = config.fieldHeight + config.fieldWidth;
    if (config.minDistanceToNest > maxDistanceToNest) {
        alert("Reset 'min. distance to nest' to max. allowed value (" + maxDistanceToNest + ")");
        config.minDistanceToNest = maxDistanceToNest;
        setHtmlInputValue('minDistanceToNest', config.minDistanceToNest);
    }
    var maxX = config.fieldWidth;
    var maxY = config.fieldHeight;
    if (config.minDistanceToNest > maxDistanceToNest / 2 && config.nests == 1) {
        maxX = config.fieldWidth - config.minDistanceToNest * config.fieldWidth / maxDistanceToNest;
        maxY = config.fieldHeight - config.minDistanceToNest * config.fieldHeight / maxDistanceToNest;
    }
    var count = 0;
    var nests = new Array(config.nests);
    while (count < config.nests) {
        var x = Math.floor(Math.random() * maxX);
        var y = Math.floor(Math.random() * maxY);
        if (field[x][y].canAddObstacle()) {
            field[x][y].setNest();
            nests.push([x, y]);
            for (var i = 0; i < config.antPopulation; i++) {
                field[x][y].addAnt(new Ant(config.initialPheromoneStrength));
            }
            count++;
        }
    }
    count = 0;
    var tries = 0;
    const maxTries = 100000;
    while (count < config.foodSources) {
        var x = Math.floor(Math.random() * config.fieldWidth);
        var y = Math.floor(Math.random() * config.fieldHeight);
        tries++;
        if (field[x][y].canAddObstacle() && calcMinDistance([x, y], nests) >= config.minDistanceToNest || tries > maxTries) {
            if (tries > maxTries) {
                alert("Couldn't find a solution for 'min. distance to nest = " + config.minDistanceToNest + "'");
            }
            field[x][y].addFood();
            count++;
            tries = 0;
        }
    }
    count = 0;
    while (count < config.obstacles) {
        var x = Math.floor(Math.random() * config.fieldWidth);
        var y = Math.floor(Math.random() * config.fieldHeight);
        if (field[x][y].canAddObstacle()) {
            field[x][y].maxAnts = 0;
            count++;
        }
    }
    return true;
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
    // var neighbourCells = [1, 3, 5, 7]; // top, left, right, bottom
    var neighbourCells = [0, 1, 2, 3, 5, 6, 7, 8];
    neighbourCells = randomizeArray(neighbourCells);
    var neighbours = [];
    var neighbourScores = [];
    for (var i = 0; i < neighbourCells.length; i++) {
        var n = neighbourCells[i];
        var nx = Math.floor(n / 3);
        var ny = n % 3;
        var rx = nx - 1 + x;
        var ry = ny - 1 + y;
        if (rx < 0 || rx >= config.fieldWidth || ry < 0 || ry >= config.fieldHeight) {
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
function minimisationAlgorithm(field, x, y, minToNest) {
    var cell = field[x][y];
    var neighbourCells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    var neighbours = [];
    neighbours.pop();
    for (var i = 0; i < neighbourCells.length; i++) {
        var n = neighbourCells[i];
        var nx = Math.floor(n / 3);
        var ny = n % 3;
        var rx = nx - 1 + x;
        var ry = ny - 1 + y;
        if (rx < 0 || rx >= config.fieldWidth || ry < 0 || ry >= config.fieldHeight) {
            continue;
        }
        neighbours.push(field[rx][ry]);
    }
    var toSpread = config.minimisationSpreadValue;
    if (minToNest) {
        toSpread += cell.toNestPheromone * config.minimisationSpreadPercentage / 100;
        if (cell.toNestPheromone - toSpread <= 0)
            return;
        cell.toNestPheromone -= toSpread;
    }
    else {
        toSpread += cell.toFoodPheromone * config.minimisationSpreadPercentage / 100;
        if (cell.toFoodPheromone - toSpread <= 0)
            return;
        cell.toFoodPheromone -= toSpread;
    }
    var eliminated = true;
    var av_q = 0;
    while (eliminated) {
        eliminated = false;
        av_q = 0;
        neighbours.forEach(element => {
            if (minToNest)
                av_q += element.toNestPheromone;
            else
                av_q += element.toFoodPheromone;
        });
        av_q += toSpread;
        av_q /= neighbours.length;
        for (i = 0; i < neighbours.length; i++) {
            if (minToNest) {
                if (neighbours[i].toNestPheromone > av_q) {
                    eliminated = true;
                    neighbours.splice(i, 1);
                    i--;
                }
            }
            else {
                if (neighbours[i].toFoodPheromone > av_q) {
                    eliminated = true;
                    neighbours.splice(i, 1);
                    i--;
                }
            }
        }
    }
    if (neighbours.length <= 0)
        return;
    neighbours.forEach(element => {
        if (minToNest) {
            var f = av_q - element.toNestPheromone;
            element.toNestPheromone += Math.abs(f);
        }
        else {
            var f = av_q - element.toFoodPheromone;
            element.toFoodPheromone += Math.abs(f);
        }
    });
}
function transition(field, x, y) {
    var cell = field[x][y];
    if (config.minimisationAlgorithmEnabled) {
        minimisationAlgorithm(field, x, y, true);
        minimisationAlgorithm(field, x, y, false);
    }
    for (var a = 0; a < cell.ants.length; a++) {
        var ant = cell.ants[a];
        if (ant.moved === true) {
            return;
        }
        ant.moved = true;
        var bestCell = getBestCellAnt(field, x, y, ant);
        if (bestCell != null && bestCell != cell) {
            if (bestCell.addAnt(ant)) {
                cell.ants.splice(a, 1); // remove from current cell
                a--;
                if (ant.direction === 0 /* toFood */) {
                    bestCell.addtoNestPheromone(ant.pheromoneStrength);
                    if (bestCell.food && !ant.hasFood) {
                        ant.direction = 1 /* toNest */;
                        bestCell.takeFood();
                        ant.hasFood = true;
                        ant.pheromoneStrength = Math.max(config.initialPheromoneStrength, ant.pheromoneStrength);
                        //ant.pheromoneStrength = config.initialPheromoneStrength;
                        statistics.foodInSources--;
                        statistics.antsWithFood++;
                    }
                }
                else {
                    bestCell.addToFoodPheromone(ant.pheromoneStrength);
                    if (bestCell.nest && ant.hasFood) {
                        ant.direction = 0 /* toFood */;
                        ant.hasFood = false;
                        ant.pheromoneStrength = config.initialPheromoneStrength;
                        statistics.foodInNests++;
                        statistics.antsWithFood--;
                    }
                }
                ant.decreasePheromoneStrength();
            }
        }
    }
}
function updateField() {
    randomField = randomizeArray(randomField);
    for (var i = 0; i < randomField.length; i++) {
        var n = randomField[i];
        var y = Math.floor(n / config.fieldWidth);
        var x = n % config.fieldWidth;
        transition(field, x, y);
    }
    // reset moved flag
    for (var i = 0; i < config.fieldWidth; i++) {
        for (var j = 0; j < config.fieldHeight; j++) {
            if (field[i][j] != null) {
                field[i][j].setMoved(false);
                field[i][j].decreasePheromone();
            }
        }
    }
}
function drawClearField() {
    // draw ground
    ctx.fillStyle = config.groundColor;
    var ps = config.seperatePheromoneView ? pixelSize / 2 : pixelSize;
    ctx.fillRect(0, 0, config.fieldWidth * ps, config.fieldHeight * ps);
    if (config.seperatePheromoneView) {
        ctx.fillRect(config.fieldWidth * ps, 0, config.fieldWidth * ps, config.fieldHeight * ps);
        ctx.fillRect(0, config.fieldHeight * ps, config.fieldWidth * ps, config.fieldHeight * ps);
    }
}
function drawField() {
    var savedPixelSize = pixelSize;
    var offsetX, offsetY;
    if (config.seperatePheromoneView) {
        pixelSize = pixelSize / 2;
        offsetX = config.fieldWidth * pixelSize;
        offsetY = config.fieldHeight * pixelSize;
    }
    ctx.font = pixelSize / 2 + "px Courier New";
    for (var i = 0; i < config.fieldWidth; i++) {
        for (var j = 0; j < config.fieldHeight; j++) {
            var cell = field[i][j];
            var cellColor = cell.color;
            ctx.fillStyle = cellColor;
            ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
            if (config.seperatePheromoneView) {
                if (cell.toFoodPheromone > 0) {
                    // var toFoodColorValue = Math.round((cell.toFoodPheromone / config.maxPheromone) * 200) + 55; // skip to dark values
                    // ctx.fillStyle = "rgba(0, " + toFoodColorValue + ", 0, 1.0)";
                    var toFoodColorPercent = cell.toFoodPheromone / config.maxPheromone;
                    ctx.fillStyle = "rgba(0, 120, 0, " + toFoodColorPercent + ")";
                    ctx.fillRect(i * pixelSize + offsetX, j * pixelSize, pixelSize, pixelSize);
                    ctx.fillStyle = "#000000";
                    ctx.fillText("" + Math.ceil(field[i][j].toFoodPheromone), (i) * pixelSize + offsetX, (j) * pixelSize + 0.6 * pixelSize);
                }
                if (cell.toNestPheromone > 0) {
                    // var toNestColorValue = Math.round((cell.toNestPheromone / config.maxPheromone) * 200) + 55;// skip to dark values
                    // ctx.fillStyle = "rgba(" + toNestColorValue + ", 0, 0, 1.0)";
                    var toNestColorPercent = cell.toNestPheromone / config.maxPheromone;
                    ctx.fillStyle = "rgba(120, 0, 0, " + toNestColorPercent + ")";
                    ctx.fillRect(i * pixelSize, j * pixelSize + offsetY, pixelSize, pixelSize);
                    ctx.fillStyle = "#000000";
                    ctx.fillText("" + Math.ceil(field[i][j].toNestPheromone), (i) * pixelSize, (j) * pixelSize + 0.6 * pixelSize + offsetY);
                }
                if (cell.ants.length > 0 || cell.food > 0 || cell.nest == true || cell.maxAnts == 0) {
                    ctx.fillStyle = cellColor;
                    ctx.fillRect(i * pixelSize + offsetX, j * pixelSize, pixelSize, pixelSize);
                    ctx.fillRect(i * pixelSize, j * pixelSize + offsetY, pixelSize, pixelSize);
                }
            }
            else {
                if (field[i][j].toFoodPheromone > 0) {
                    ctx.fillStyle = config.ToFoodPheromoneColor;
                    ctx.fillText("" + Math.ceil(field[i][j].toFoodPheromone), (i) * pixelSize, (j) * pixelSize + pixelSize);
                }
                if (field[i][j].toNestPheromone > 0) {
                    ctx.fillStyle = config.ToNestPheromoneColor;
                    ctx.fillText("" + Math.ceil(field[i][j].toNestPheromone), (i) * pixelSize, (j) * pixelSize + 0.5 * pixelSize);
                }
            }
        }
    }
    if (config.seperatePheromoneView) {
        ctx.fillStyle = "#000000";
        var lineWidth = pixelSize / 4;
        ctx.lineWidth = lineWidth;
        var lineOffset = lineWidth / 2;
        ctx.beginPath();
        ctx.moveTo(offsetX + lineOffset, 0);
        ctx.lineTo(offsetX + lineOffset, offsetY + lineWidth);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, offsetY + lineOffset);
        ctx.lineTo(offsetX + lineWidth, offsetY + lineOffset);
        ctx.stroke();
        ctx.font = "48px Helvetica";
        ctx.fillText("← To Nest", offsetX + pixelSize, offsetY * 1.6);
        ctx.fillText("↑ To Food", offsetX * 1.25, offsetY * 1.2);
        pixelSize = savedPixelSize;
    }
}
function changeFps() {
    config.fps = getValueFromHMTLInput('fps');
    setHtmlInputValue('fpsNumber', config.fps);
}
function restoreDefaultConfig() {
    config = JSON.parse(JSON.stringify(default_config));
    fillHtmlInputs(config);
}
function startSimulation() {
    pauseFlag = false;
    readConfigurationValues(config);
    init();
    initRandomValues(field);
    startCount++;
    gameloop(startCount);
    resetStatistics();
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
    fillHtmlInputs(config);
    startButton = document.getElementById("btn-start-simulation");
    pauseButton = document.getElementById("btn-pause-simulation");
    resumeButton = document.getElementById("btn-resume-simulation");
};
//# sourceMappingURL=main.js.map