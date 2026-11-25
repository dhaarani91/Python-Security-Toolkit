// =====================================
// Advanced Private Cloud CSPM Dashboard
// =====================================

// Dashboard Statistics

const dashboardData = {

    totalVMs: 1,
    compliance: 100,
    risk: 0,
    alerts: 0

};

// Update Dashboard Cards

function updateDashboard(){

    document.getElementById("vmCount").innerHTML =
    dashboardData.totalVMs;

    document.getElementById("compliance").innerHTML =
    dashboardData.compliance + "%";

    document.getElementById("risk").innerHTML =
    dashboardData.risk + "%";

    document.getElementById("alerts").innerHTML =
    dashboardData.alerts;

}

// Progress Circle

function updateProgress(){

    const progress =
    document.getElementById("progressValue");

    if(progress){

        progress.innerHTML =
        dashboardData.compliance + "%";

    }

}

// Clock

function updateClock(){

    const clock =
    document.getElementById("clock");

    if(clock){

        const now = new Date();

        clock.innerHTML =
        now.toLocaleString();

    }

}

// Auto Refresh

setInterval(updateClock,1000);

// Load Dashboard

window.onload=function(){

    updateDashboard();

    updateProgress();

    updateClock();

}
