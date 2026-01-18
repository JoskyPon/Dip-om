document.addEventListener('DOMContentLoaded', function() {


let KBM = document.querySelector('.input-KBM')
let KVS = document.querySelector('.input-KVS')
let KO = document.querySelector('.input-KO')
let KM = document.querySelector('.input-KM')
let KS = document.querySelector('.input-KS')
let COST = document.querySelector('.input-COST')
let baseCost = 4500

let kaskoCost = document.querySelector('.kasko')
let osagoCost = document.querySelector('.osago')

let calcButton = document.querySelector('.calculated__button')

function calculatedKO (KO) {
    if (KO.value == 1) {
        return 1
    } else {
        return 2.26
    }
}

function calculatedKM (KM) {
    if (KM.value <= 50) {
        return 0.6
    } else if (KM.value > 50 && KM.value <= 70) {
        return 1
    } else if (KM.value > 70 && KM.value <= 100) {
        return 1.1
    } else if (KM.value > 100 && KM.value <= 120) {
        return 1.2
    } else if (KM.value > 120 && KM.value <= 150) {
        return 1.4
    } else if (KM.value > 150) {
        return 1.6
    }
}

function calculatedKS (KS) {
    if (KS.value <= 3) {
        return 0.5
    } else if (KS.value == 4) {
        return 0.6
    } else if (KS.value == 5) {
        return 0.65
    } else if (KS.value == 6) {
        return 0.7
    } else if (KS.value == 7) {
        return 0.8
    } else if (KS.value == 8) {
        return 0.9
    } else if (KS.value == 9) {
        return 0.95
    } else if (KS.value > 9  && KS.value <= 12) {
        return 1
    }
}

calcButton.addEventListener('click', function() {
    let calcKBM = KBM.value * 1.2
    let calcKVS = KVS.value * 1.1
    let calcKO = calculatedKO(KO)
    let calcKM = calculatedKM(KM)
    let calcKS = calculatedKS(KS)
    let caclCOST = COST.value
    let finalCostCASCO = Math.round(baseCost * caclCOST * calcKBM * calcKVS * calcKM * calcKO * calcKS)
    let finalCostOSAGO = Math.round(baseCost * calcKBM * calcKVS * calcKM * calcKO * calcKS)

    kaskoCost.innerHTML = `Примерная стоимость полиса КАСКО: ${finalCostCASCO}₽`
    osagoCost.innerHTML = `Примерная стоимость полиса ОСАГО: ${finalCostOSAGO}₽`
})

calcButton.addEventListener('click', function(e) {
    e.preventDefault()
})

})

