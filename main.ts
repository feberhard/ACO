/*
 * //==============================================\\
 * || Project: Ant Colony Optimization             ||
 * || Authors: Eberhard Felix, Dorfmeister Daniel, ||
 * ||          De Rosis Alessandro                 ||
 * || Date:    05.12.2016                          ||
 * \\==============================================// 
 */

// start vs-code task: ctrl+shift+b


// variables
var minimisationAlgorithmEnabled = true;
var fieldWidth = 20;
var fieldHeight = fieldWidth;
var pixelSize = 500 / fieldWidth;
var field: Cell[][];
var randomField: number[];
var randomNeighbour: number[];
var colorArray: string[][][];

var canvas: HTMLCanvasElement;
var ctx: CanvasRenderingContext2D;

var default_config = {
    // colors
    groundColor: "#A08556", // brown
    foodColor: "#246D25", // green
    antToFoodColor: "#000000", // black
    antToNestColor: "#CCCC00", // yellow
    nestColor: "#FF0000", // red
    obstacleColor: "#0000FF", // blue

    // ant
    antPopulation: 20,
    initialPheremoneStrength: 300,

    // food
    foodSources: 1,
    maxFood: 200,

    // nest
    nests: 1,

    // cell
    maxPheromone: 300,
    maxAnts: 100,
    obstacles: 20,

    // general
    fps: 100,
    // maxCellSize: 1, // max number of ants per cell
    // leavePheromoneAmout: 50
};

var config = JSON.parse(JSON.stringify(default_config));

var default_statistics = {
    foodInSources: 0,
    foodInNests: 0,
    antsWithFood: 0,
};

var statistics = JSON.parse(JSON.stringify(default_statistics));

class Cell {
    public ants: Ant[];
    public maxAnts: number;

    public toNestPheromone: number;
    public toFoodPheromone: number;

    // TODO probably make food a number which decreases every time an ant eats from it
    public food: number;
    public nest: boolean;

    get color(): string {
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

    constructor(public col: number, public row: number, maxAnts: number, food: number = 0, nest: boolean = false) {
        this.ants = [];
        this.maxAnts = maxAnts;
        this.food = food;
        this.nest = nest;
        this.toNestPheromone = 0;
        this.toFoodPheromone = 0;
    }

    public canAddAnt() {
        return this.ants.length < this.maxAnts;
    }

    public addAnt(ant: Ant) {
        if (this.canAddAnt()) {
            this.ants.push(ant);
            return true;
        }
        return false;
    }

    public canAddObstacle() {
        return !this.nest && !this.food && this.maxAnts != 0;
    }

    public addFood(food: number = config.maxFood) {
        this.food = Math.min(this.food + food, config.maxFood);
    }

    public takeFood() {
        this.food = Math.max(this.food - 1, 0);
    }

    public setNest() {
        this.nest = true;
    }

    public setMoved(moved: boolean) {
        this.ants.forEach(a => a.moved = moved);
    }

    public decreasePheromone() {
        this.toFoodPheromone = Math.max(this.toFoodPheromone - 1, 0);
        this.toNestPheromone = Math.max(this.toNestPheromone - 1, 0);
    }

    public addtoNestPheromone(pheromone: number) {
        this.toNestPheromone = Math.min(this.toNestPheromone + pheromone, config.maxPheromone);
    }

    public addToFoodPheromone(pheromone: number) {
        this.toFoodPheromone = Math.min(this.toFoodPheromone + pheromone, config.maxPheromone);
    }
}

const enum Direction {
    toFood = 0,
    toNest = 1
}

class Ant {
    public moved: boolean;
    public direction: Direction;
    public pheromoneStrength: number;
    public hasFood: boolean = false;

    constructor(pheromoneStrength: number) {
        this.direction = Direction.toFood;
        this.pheromoneStrength = pheromoneStrength;
    }

    public decreasePheromoneStrength() {
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
    colorArray = new Array<string[][]>(maxAnts + 1);
    for (var i = 0; i < maxAnts + 1; i++) {
        colorArray[i] = new Array<string[]>(maxFood + 1);

        var antPercent = i / maxAnts;
        for (var j = 0; j < maxFood + 1; j++) {
            colorArray[i][j] = new Array<string>(2);
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
            colorArray[i][j][Direction.toFood] = cellColorToFood;
            colorArray[i][j][Direction.toNest] = cellColorToNest;

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
    field = new Array(fieldWidth);

    for (var i = 0; i < fieldWidth; i++) {
        field[i] = new Array(fieldHeight);
        for (var j = 0; j < fieldHeight; j++) {
            field[i][j] = new Cell(i, j, config.maxAnts);
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
//         field[fieldWidth - Math.round(fieldWidth / 4)][fieldHeight - Math.round(fieldWidth / 4)].addAnt(new Ant(config.initialPheremoneStrength));
//     }
// }

function initRandomValues(field: Cell[][]) {
    var count = 0;
    while (count < config.nests) {
        var x = Math.floor(Math.random() * fieldWidth);
        var y = Math.floor(Math.random() * fieldHeight);

        if (field[x][y].canAddObstacle()) {
            field[x][y].setNest();

            for (var i = 0; i < config.antPopulation; i++) {
                field[x][y].addAnt(new Ant(config.initialPheremoneStrength));
            }
            count++;
        }
    }

    count = 0;
    while (count < config.foodSources) {
        var x = Math.floor(Math.random() * fieldWidth);
        var y = Math.floor(Math.random() * fieldHeight);

        if (field[x][y].canAddObstacle()) {
            field[x][y].addFood();
            count++;
        }
    }

    count = 0;
    while (count < config.obstacles) {
        var x = Math.floor(Math.random() * fieldWidth);
        var y = Math.floor(Math.random() * fieldHeight);

        if (field[x][y].canAddObstacle()) {
            field[x][y].maxAnts = 0;
            count++;
        }
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

function getCellScoreAnt(cell: Cell, ant: Ant) {
    if (!cell.canAddAnt()) // no room on cell
        return -1;

    if (ant.direction === Direction.toNest) {
        if (cell.nest) {
            return Number.MAX_VALUE;
        }
        return cell.toNestPheromone;
    } else {
        if (cell.food) {
            return Number.MAX_VALUE;
        }
        return cell.toFoodPheromone;
    }
}

// get best neighbouring cell for the ant to move (can also be the cell he is currently in)
function getBestCell(field: Cell[][], x: number, y: number, ant: Ant, scoreFunction: (cell: Cell, ant: Ant) => number) {
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

function getBestCellAnt(field: Cell[][], x: number, y: number, ant: Ant) {
    return getBestCell(field, x, y, ant, this.getCellScoreAnt);
}

function minimisationAlgorithm(field: Cell[][], x: number, y: number,minToNest: boolean){
    var cell = field[x][y];

    var neighbourCells = [0, 1, 2, 3, 5, 6, 7, 8]; 
    var neighbours = [];
    neighbours.pop()

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
        

        neighbours.push(cell);
    }

    //var toSpread : number = cell.toNestPheromone*1/100;
    var toSpread = 1;

    if(minToNest)
        if(cell.toNestPheromone - toSpread<=0)
            return;
        else
            cell.toNestPheromone-=toSpread;
    else
        if(cell.toFoodPheromone - toSpread<=0)
            return;
        else
            cell.toFoodPheromone-=toSpread;


    var eliminated = true;

    while(eliminated){
        eliminated=false;
        var av=0;
        neighbours.forEach(element => {
            if(minToNest)
                av+=element.toNestPheromone;
            else    
                av+=element.toFoodPheromone;
        });
        av+=toSpread;
        av/=neighbours.length;
        for(i = 0;i<neighbours.length;i++){
            if(minToNest){
                if(neighbours[i].toNestPheromone>av){
                    eliminated=true;
                    neighbours.splice(i);
                    i--;                     
                }
            }
            else{
                if(neighbours[i].toFoodPheromone>av){
                    eliminated=true;
                    neighbours.splice(i);
                    i--;                     
                }
            }

        }
    }
    if(neighbours.length<=0)
        return ;
    var av_q = 0
    neighbours.forEach(element => {
        if(minToNest)
            av_q+=element.toNestPheromone;
        else
            av_q+=element.toFoodPheromone;
    });
    av_q += toSpread;
    av_q /=neighbours.length;

    neighbours.forEach(element => {
        if(minToNest){
            var f= av_q- element.toNestPheromone;
            element.toNestPheromone+=Math.abs(f);
        }
        else{
            var f= av_q- element.toFoodPheromone;
            element.toFoodPheromone+=Math.abs(f);
        }
    });

}

function transition(field: Cell[][], x: number, y: number) {
    var cell = field[x][y];

    if(minimisationAlgorithmEnabled){
        minimisationAlgorithm(field,x,y,true);
        minimisationAlgorithm(field,x,y,false);
    }

    for (var a = 0; a < cell.ants.length; a++) {
        var ant = cell.ants[a];
        if (ant.moved === true) {
            return;
        }
        ant.moved = true;

        var bestCell = getBestCellAnt(field, x, y, ant);
        if (bestCell != null && bestCell != cell) { // move ant
            if (bestCell.addAnt(ant)) { // add to better cell
                cell.ants.splice(a, 1); // remove from current cell
                a--;

                if (ant.direction === Direction.toFood) {
                    bestCell.addtoNestPheromone(ant.pheromoneStrength);
                    if (bestCell.food && !ant.hasFood) { // take food
                        ant.direction = Direction.toNest;
                        bestCell.takeFood();
                        ant.hasFood = true;
                        ant.pheromoneStrength = Math.max(config.initialPheremoneStrength, ant.pheromoneStrength);
                        //ant.pheromoneStrength = config.initialPheremoneStrength;

                        statistics.foodInSources--;
                        statistics.antsWithFood++;
                    }
                } else {
                    bestCell.addToFoodPheromone(ant.pheromoneStrength);
                    if (bestCell.nest && ant.hasFood) {
                        ant.direction = Direction.toFood;
                        ant.hasFood = false;
                        ant.pheromoneStrength = config.initialPheremoneStrength;

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

            if (field[i][j].toFoodPheromone) {
                ctx.fillStyle = "#DDFFDD";
                ctx.fillText("" + field[i][j].toFoodPheromone, (i) * pixelSize, (j) * pixelSize + pixelSize);
            }
            if (field[i][j].toNestPheromone) {
                ctx.fillStyle = "#FFDDDD";
                ctx.fillText("" + field[i][j].toNestPheromone, (i) * pixelSize, (j) * pixelSize + 0.5 * pixelSize);
            }
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
    config = JSON.parse(JSON.stringify(default_config));
    fillHtmlInputs();
}

function startSimulation() {
    pauseFlag = false;
    readConfigurationValues();
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

var startButton: HTMLButtonElement;
var pauseButton: HTMLButtonElement;
var resumeButton: HTMLButtonElement;

window.onload = function () {
    fillHtmlInputs();

    startButton = <HTMLButtonElement>document.getElementById("btn-start-simulation");
    pauseButton = <HTMLButtonElement>document.getElementById("btn-pause-simulation");
    resumeButton = <HTMLButtonElement>document.getElementById("btn-resume-simulation");
};
