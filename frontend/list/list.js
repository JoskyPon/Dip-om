import { kvsTable } from './list-table.js';

document.addEventListener('DOMContentLoaded', function () {

    let KT = document.querySelector('.input-KT')
    let KBM = document.querySelector('.input-KBM')
    let KVSAge = document.querySelector('.input-KVS-age')
    let KVSExp = document.querySelector('.input-KVS-exp')
    let KO = document.querySelector('.input-KO')
    let KM = document.querySelector('.input-KM')
    let KS = document.querySelector('.input-KS')
    let COST = document.querySelector('.input-COST')
    let baseCost = 5000

    let kaskoCost = document.querySelector('.kasko')
    let osagoCost = document.querySelector('.osago')

    let calcButton = document.querySelector('.calculated__button')

    function calculatedKO(KO) {
        if (KO.value == 1) {
            return 1
        } else {
            return 2.26
        }
    }

    function calculatedKM(KM) {
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

    function calculatedKS(KS) {
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
        } else if (KS.value > 9 && KS.value <= 12) {
            return 1
        }
    }

    function calculatedKT(kt) {
        if (kt.value == 1) {
            return 0.97
        } else if (kt.value == 2) {
            return 1.33
        } else if (kt.value == 3) {
            return 1.17
        } else if (kt.value == 4) {
            return 0.87
        } else if (kt.value == 5) {
            return 1
        } else if (kt.value == 6) {
            return 0.76
        } else if (kt.value == 7) {
            return 0.91
        } else if (kt.value == 8) {
            return 1
        } else if (kt.value == 9) {
            return 0.94
        }
    }

    function calculatedCOST(COST) {
        return COST.value * 0.04
    }

    function getAgeGroup(age) {
        if (age >= 16 && age <= 21) return "16-21";
        if (age >= 22 && age <= 24) return "22-24";
        if (age >= 25 && age <= 29) return "25-29";
        if (age >= 30 && age <= 34) return "30-34";
        if (age >= 35 && age <= 39) return "35-39";
        if (age >= 40 && age <= 49) return "40-49";
        if (age >= 50 && age <= 59) return "50-59";
        if (age >= 59) return "59+";
        return null;
    }

    function getExperienceGroup(exp) {
        if (exp < 1) return "0";
        if (exp >= 1 && exp < 2) return "1";
        if (exp >= 2 && exp < 3) return "2";
        if (exp >= 3 && exp <= 4) return "3-4";
        if (exp >= 5 && exp <= 6) return "5-6";
        if (exp >= 7 && exp <= 9) return "7-9";
        if (exp >= 10 && exp <= 14) return "10-14";
        if (exp >= 14) return "14+";
        return null;
    }

    function calculateKVS(age, experience) {
        const ageGroup = getAgeGroup(age.value);
        const expGroup = getExperienceGroup(experience.value);

        if (!ageGroup || !expGroup) {
            return null; // или вернуть значение по умолчанию, например 1.0
        }

        // Проверяем, существует ли такое сочетание в таблице
        if (kvsTable[ageGroup] && kvsTable[ageGroup][expGroup] !== undefined) {
            return kvsTable[ageGroup][expGroup];
        } else {
            return null;
        }
    }

    calcButton.addEventListener('click', function () {
        let calcKT = calculatedKT(KT)
        let calcKBM = KBM.value
        let calcKVS = calculateKVS(KVSAge, KVSExp)
        let calcKO = calculatedKO(KO)
        let calcKM = calculatedKM(KM)
        let calcKS = calculatedKS(KS)
        let caclCOST = calculatedCOST(COST)
        let finalCostCASCO = Math.round((baseCost * calcKT * calcKBM * calcKVS * calcKM * calcKO * calcKS) + caclCOST)
        let finalCostOSAGO = Math.round(baseCost * calcKT * calcKBM * calcKVS * calcKM * calcKO * calcKS)

        kaskoCost.innerHTML = `Примерная стоимость полиса КАСКО: ${finalCostCASCO}₽`
        osagoCost.innerHTML = `Примерная стоимость полиса ОСАГО: ${finalCostOSAGO}₽`
    })

    calcButton.addEventListener('click', function (e) {
        e.preventDefault()
    })

})

