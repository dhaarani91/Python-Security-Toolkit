/* =========================================================
   CSPM REPORT MANAGEMENT
   ========================================================= */

const REPORT_URL = "../reports/report.json";

let reportData = null;
let generatedPDFUrl = null;


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, type = "info") {

    const container =
        document.getElementById("toastContainer");

    const toast =
        document.createElement("div");

    toast.className =
        "toast " + type;

    toast.innerHTML =
        message;

    container.appendChild(toast);

    setTimeout(function () {

        toast.remove();

    }, 3500);

}


/* =========================================================
   LOAD REPORT
   ========================================================= */

async function loadReport() {

    try {

        const response =
            await fetch(REPORT_URL, {
                cache: "no-store"
            });


        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );

        }


        reportData =
            await response.json();


        updateReportUI();


    } catch (error) {

        console.error(
            "Unable to load report:",
            error
        );


        showToast(
            "Unable to load report.json",
            "error"
        );


        const status =
            document.getElementById(
                "resultsStatus"
            );


        if (status) {

            status.className =
                "status-box status-error";

            status.innerHTML =
                "<strong>Error:</strong> " +
                "report.json could not be loaded. " +
                "Make sure the dashboard is running " +
                "through a local web server.";

        }

    }

}


/* =========================================================
   FIND SUMMARY
   ========================================================= */

function getSummary() {

    if (!reportData) {

        return {};

    }


    return (
        reportData.summary ||
        reportData.results ||
        {}
    );

}


/* =========================================================
   UPDATE UI
   ========================================================= */

function updateReportUI() {

    const summary =
        getSummary();


    /* Scanner */

    const scanner =
        reportData.scanner || {};


    document.getElementById(
        "scannerName"
    ).innerText =
        scanner.name || "CSPM Security Scanner";


    document.getElementById(
        "scannerVersion"
    ).innerText =
        scanner.version || "2.0";


    /* Framework */

    let frameworks =
        reportData.frameworks || [];


    if (!Array.isArray(frameworks)) {

        frameworks =
            [frameworks];

    }


    document.getElementById(
        "framework"
    ).innerText =
        frameworks.join(", ") || "CIS";


    /* Summary */

    const total =
        Number(
            summary.total_checks ??
            summary.total ??
            0
        );


    const pass =
        Number(
            summary.pass ??
            summary.passed ??
            0
        );


    const fail =
        Number(
            summary.fail ??
            summary.failed ??
            0
        );


    const info =
        Number(
            summary.info ??
            summary.information ??
            (
                total -
                pass -
                fail
            )
        );


    let compliance =
        summary.compliance_score ??
        summary.compliance ??
        summary.complianceScore;


    let risk =
        summary.risk_score ??
        summary.risk ??
        summary.riskScore;


    /* Calculate compliance if not available */

    if (
        compliance === undefined &&
        total > 0
    ) {

        compliance =
            ((pass / total) * 100)
            .toFixed(0);

    }


    /* Calculate risk if not available */

    if (
        risk === undefined &&
        total > 0
    ) {

        risk =
            ((fail / total) * 100)
            .toFixed(0);

    }


    /* Display values */

    document.getElementById(
        "totalChecks"
    ).innerText =
        total;


    document.getElementById(
        "passedChecks"
    ).innerText =
        pass;


    document.getElementById(
        "failedChecks"
    ).innerText =
        fail;


    document.getElementById(
        "infoChecks"
    ).innerText =
        info;


    document.getElementById(
        "complianceScore"
    ).innerText =
        formatPercent(compliance);


    document.getElementById(
        "riskScore"
    ).innerText =
        formatPercent(risk);


    document.getElementById(
        "summaryCompliance"
    ).innerText =
        formatPercent(compliance);


    document.getElementById(
        "summaryRisk"
    ).innerText =
        formatPercent(risk);

}


/* =========================================================
   FORMAT PERCENT
   ========================================================= */

function formatPercent(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return "--";

    }


    const stringValue =
        String(value);


    if (
        stringValue.includes("%")
    ) {

        return stringValue;

    }


    return stringValue + "%";

}


/* =========================================================
   VIEW SCANNER RESULTS
   ========================================================= */

async function viewScannerResults() {

    const resultPanel =
        document.getElementById(
            "scannerResults"
        );


    const status =
        document.getElementById(
            "resultsStatus"
        );


    const viewer =
        document.getElementById(
            "jsonViewer"
        );


    resultPanel.classList.add(
        "show"
    );


    status.className =
        "status-box status-info";


    status.innerHTML =
        "<i class='fa-solid fa-spinner fa-spin'></i> " +
        "Loading scanner results...";


    try {

        if (!reportData) {

            const response =
                await fetch(
                    REPORT_URL,
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "HTTP " +
                    response.status
                );

            }


            reportData =
                await response.json();

        }


        viewer.textContent =
            JSON.stringify(
                reportData,
                null,
                4
            );


        status.className =
            "status-box status-success";


        status.innerHTML =
            "<i class='fa-solid fa-circle-check'></i> " +
            "Scanner results loaded successfully.";


        resultPanel.scrollIntoView({
            behavior: "smooth"
        });


    } catch (error) {

        console.error(error);


        status.className =
            "status-box status-error";


        status.innerHTML =
            "<strong>Error:</strong> " +
            "Could not load report.json.";

        viewer.textContent =
            "";

    }

}


/* =========================================================
   DOWNLOAD JSON
   ========================================================= */

async function downloadJSON() {

    try {

        const response =
            await fetch(
                REPORT_URL,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const jsonText =
            await response.text();


        const blob =
            new Blob(
                [jsonText],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            "cspm-report.json";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        showToast(
            "JSON report downloaded successfully.",
            "success"
        );


    } catch (error) {

        console.error(error);


        showToast(
            "Unable to download report.json.",
            "error"
        );

    }

}


/* =========================================================
   GENERATE PDF
   ========================================================= */

function generatePDF() {

    if (!reportData) {

        showToast(
            "Scanner report is not loaded yet.",
            "error"
        );

        return;

    }


    try {

        /* Create printable HTML */

        const summary =
            getSummary();


        const scanner =
            reportData.scanner || {};


        let frameworks =
            reportData.frameworks || [];


        if (!Array.isArray(frameworks)) {

            frameworks =
                [frameworks];

        }


        const total =
            Number(
                summary.total_checks ??
                summary.total ??
                0
            );


        const pass =
            Number(
                summary.pass ??
                summary.passed ??
                0
            );


        const fail =
            Number(
                summary.fail ??
                summary.failed ??
                0
            );


        const info =
            Number(
                summary.info ??
                summary.information ??
                (
                    total -
                    pass -
                    fail
                )
            );


        let compliance =
            summary.compliance_score ??
            summary.compliance ??
            summary.complianceScore;


        let risk =
            summary.risk_score ??
            summary.risk ??
            summary.riskScore;


        if (
            compliance === undefined &&
            total > 0
        ) {

            compliance =
                ((pass / total) * 100)
                .toFixed(0);

        }


        if (
            risk === undefined &&
            total > 0
        ) {

            risk =
                ((fail / total) * 100)
                .toFixed(0);

        }


        /* Rules */

        const rules =
            Array.isArray(
                reportData.rules
            )
                ? reportData.rules
                : [];


        let ruleRows = "";


        rules.forEach(
            function(rule, index) {

                const ruleId =
                    rule.rule_id ??
                    rule.id ??
                    "RULE-" +
                    (index + 1);


                const name =
                    rule.name ??
                    rule.rule ??
                    rule.title ??
                    "Security Check";


                const category =
                    rule.category ??
                    "-";


                const status =
                    rule.status ??
                    "INFO";


                const severity =
                    rule.severity ??
                    "-";


                const expected =
                    rule.expected ??
                    "-";


                const actual =
                    rule.actual ??
                    "-";


                ruleRows += `

                    <tr>

                        <td>${escapeHTML(name)}</td>

                        <td>${escapeHTML(ruleId)}</td>

                        <td>${escapeHTML(category)}</td>

                        <td>${escapeHTML(status)}</td>

                        <td>${escapeHTML(severity)}</td>

                        <td>${escapeHTML(expected)}</td>

                        <td>${escapeHTML(actual)}</td>

                    </tr>

                `;

            }
        );


        /* Open printable window */

        const printWindow =
            window.open(
                "",
                "_blank"
            );


        if (!printWindow) {

            showToast(
                "Please allow pop-ups to generate the PDF.",
                "error"
            );

            return;

        }


        const generatedDate =
            new Date()
                .toLocaleString();


        printWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
CSPM Compliance Report
</title>

<style>

body {

    font-family:
        Arial,
        sans-serif;

    margin:
        35px;

    color:
        #111827;

}

h1 {

    margin-bottom:
        5px;

}

h2 {

    margin-top:
        30px;

}

.header {

    border-bottom:
        2px solid #111827;

    padding-bottom:
        15px;

}

.info {

    margin-top:
        20px;

}

.summary {

    display:
        grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap:
        12px;

    margin-top:
        20px;

}

.box {

    border:
        1px solid #d1d5db;

    padding:
        15px;

    border-radius:
        8px;

}

.box h3 {

    margin:
        0 0 8px 0;

    font-size:
        14px;

}

.box p {

    font-size:
        25px;

    font-weight:
        bold;

    margin:
        0;

}

table {

    width:
        100%;

    border-collapse:
        collapse;

    margin-top:
        15px;

    font-size:
        11px;

}

th,
td {

    border:
        1px solid #d1d5db;

    padding:
        7px;

    text-align:
        left;

}

th {

    background:
        #f3f4f6;

}

.footer {

    margin-top:
        40px;

    border-top:
        1px solid #d1d5db;

    padding-top:
        10px;

    font-size:
        11px;

}

@media print {

    body {

        margin:
            15mm;

    }

}

</style>

</head>


<body>


<div class="header">

    <h1>
        Advanced Private Cloud CSPM
    </h1>

    <p>
        Security Compliance & Audit Report
    </p>

</div>


<div class="info">

    <p>
        <strong>Scanner:</strong>
        ${escapeHTML(
            scanner.name ||
            "CSPM Security Scanner"
        )}
    </p>

    <p>
        <strong>Version:</strong>
        ${escapeHTML(
            scanner.version ||
            "2.0"
        )}
    </p>

    <p>
        <strong>Framework:</strong>
        ${escapeHTML(
            frameworks.join(", ")
        )}
    </p>

    <p>
        <strong>Target:</strong>
        Linux Virtual Machine
    </p>

    <p>
        <strong>Controller:</strong>
        Kali Linux
    </p>

    <p>
        <strong>Generated:</strong>
        ${escapeHTML(
            generatedDate
        )}
    </p>

</div>


<h2>
    Security Assessment Summary
</h2>


<div class="summary">

    <div class="box">

        <h3>
            Total Checks
        </h3>

        <p>
            ${total}
        </p>

    </div>


    <div class="box">

        <h3>
            Passed
        </h3>

        <p>
            ${pass}
        </p>

    </div>


    <div class="box">

        <h3>
            Failed
        </h3>

        <p>
            ${fail}
        </p>

    </div>


    <div class="box">

        <h3>
            Information
        </h3>

        <p>
            ${info}
        </p>

    </div>

</div>


<h2>
    Compliance & Risk
</h2>


<table>

<tr>

    <th>
        Compliance Score
    </th>

    <th>
        Risk Score
    </th>

</tr>

<tr>

    <td>
        ${formatPercent(compliance)}
    </td>

    <td>
        ${formatPercent(risk)}
    </td>

</tr>

</table>


<h2>
    CIS-Aligned Security Checks
</h2>


<table>

<thead>

<tr>

    <th>
        Rule
    </th>

    <th>
        Rule ID
    </th>

    <th>
        Category
    </th>

    <th>
        Status
    </th>

    <th>
        Severity
    </th>

    <th>
        Expected
    </th>

    <th>
        Actual
    </th>

</tr>

</thead>


<tbody>

${ruleRows}

</tbody>

</table>


<div class="footer">

    <p>
        Generated by Advanced Private Cloud CSPM
    </p>

    <p>
        CIS-aligned Linux security assessment
    </p>

</div>


</body>

</html>

        `);


        printWindow.document.close();


        /* Give browser time to render */

        setTimeout(
            function() {

                printWindow.focus();

                printWindow.print();


                showToast(
                    "PDF print dialog opened. Choose 'Save as PDF'.",
                    "success"
                );

            },
            700
        );


        /*
           Also create a local HTML/PDF-view
           marker after generation.
        */

        document.getElementById(
            "pdfCount"
        ).innerText =
            "1";


        document.getElementById(
            "pdfDate"
        ).innerText =
            new Date()
                .toLocaleDateString();


        document.getElementById(
            "pdfStatus"
        ).innerText =
            "Generated";


        document.getElementById(
            "pdfStatus"
        ).className =
            "badge pass";


        document.getElementById(
            "viewPdfBtn"
        ).disabled =
            false;


    } catch (error) {

        console.error(error);


        showToast(
            "PDF generation failed.",
            "error"
        );

    }

}


/* =========================================================
   VIEW PDF
   ========================================================= */

function viewPDF() {

    /*
       Browser-side JavaScript cannot reliably create a
       permanent PDF file inside the reports directory.

       Therefore this opens the browser print/PDF view
       using the same report.
    */

    if (!reportData) {

        showToast(
            "Load scanner report first.",
            "error"
        );

        return;

    }


    generatePDF();

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadReport();

    }
);
