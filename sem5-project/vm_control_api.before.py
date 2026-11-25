from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import json
from pathlib import Path
import time

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
REPORT_FILE = BASE_DIR / "reports" / "report.json"

VM_NAMES = ["vm1", "vm2"]


def run_command(command):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode
        }

    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1
        }


@app.route("/")
def home():
    return jsonify({
        "message": "SENTINELFORGE Flask API is running"
    })


@app.route("/api/test")
def test():
    return jsonify({
        "success": True,
        "message": "API connection working"
    })

@app.route("/api/vms")
def list_vms():

    result = run_command([
        "virsh",
        "list",
        "--all",
        "--name"
    ])

    if not result["success"]:
        return jsonify(result), 500

    vm_names = [
        name.strip()
        for name in result["stdout"].splitlines()
        if name.strip()
    ]

    vms = []

    for vm_name in vm_names:

        state_result = run_command([
            "virsh",
            "domstate",
            vm_name
        ])

        state = (
            state_result["stdout"]
            if state_result["success"]
            else "unknown"
        )

        vms.append({
            "name": vm_name,
            "state": state
        })

    return jsonify({
        "success": True,
        "count": len(vms),
        "vms": vms
    })

@app.route("/api/vm/<vm_name>/status")
def vm_status(vm_name):

    if vm_name not in VM_NAMES:
        return jsonify({
            "success": False,
            "error": "Unknown VM"
        }), 404

    result = run_command([
        "virsh",
        "domstate",
        vm_name
    ])

    if not result["success"]:
        return jsonify(result), 500

    return jsonify({
        "success": True,
        "vm": vm_name,
        "status": result["stdout"]
    })


@app.route("/api/vm/<vm_name>/start", methods=["POST"])
def start_vm(vm_name):

    if vm_name not in VM_NAMES:
        return jsonify({
            "success": False,
            "error": "Unknown VM"
        }), 404

    result = run_command([
        "virsh",
        "start",
        vm_name
    ])

    return jsonify(result)


@app.route("/api/vm/<vm_name>/stop", methods=["POST"])
def stop_vm(vm_name):

    if vm_name not in VM_NAMES:
        return jsonify({
            "success": False,
            "error": "Unknown VM"
        }), 404

    result = run_command([
        "virsh",
        "shutdown",
        vm_name
    ])

    return jsonify(result)


@app.route("/api/vm/<vm_name>/restart", methods=["POST"])
def restart_vm(vm_name):

    if vm_name not in VM_NAMES:
        return jsonify({
            "success": False,
            "error": "Unknown VM"
        }), 404

    result = run_command([
        "virsh",
        "reboot",
        vm_name
    ])

    return jsonify(result)

@app.route("/api/vm/<vm_name>/stats")
def vm_stats(vm_name):

    if vm_name not in VM_NAMES:
        return jsonify({
            "success": False,
            "error": "Unknown VM"
        }), 404

    # ----------------------------------------
    # Get basic VM information
    # ----------------------------------------

    info_result = run_command([
        "virsh",
        "dominfo",
        vm_name
    ])

    if not info_result["success"]:
        return jsonify(info_result), 500

    info = {}

    for line in info_result["stdout"].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            info[key.strip()] = value.strip()

    # ----------------------------------------
    # Get VM IP address
    # ----------------------------------------

    ip_result = run_command([
        "virsh",
        "domifaddr",
        vm_name,
        "--source",
        "lease"
    ])

    ip_address = None

    if ip_result["success"]:

        for line in ip_result["stdout"].splitlines():

            parts = line.split()

            if len(parts) >= 4 and parts[2] == "ipv4":
                ip_address = parts[3].split("/")[0]
                break

    # ----------------------------------------
    # CPU count
    # ----------------------------------------

    cpu_count = None

    if info.get("CPU(s)", "").isdigit():
        cpu_count = int(info["CPU(s)"])

    # ----------------------------------------
    # CPU usage
    # ----------------------------------------

    cpu_usage_percent = None

    if cpu_count and info.get("State") == "running":

        sample1 = run_command([
            "virsh",
            "domstats",
            vm_name,
            "--cpu-total"
        ])

        if sample1["success"]:

            cpu_time_1 = None

            for line in sample1["stdout"].splitlines():

                if line.strip().startswith("cpu.time="):
                    cpu_time_1 = int(
                        line.strip().split("=")[1]
                    )
                    break

            if cpu_time_1 is not None:

                time.sleep(1)

                sample2 = run_command([
                    "virsh",
                    "domstats",
                    vm_name,
                    "--cpu-total"
                ])

                if sample2["success"]:

                    cpu_time_2 = None

                    for line in sample2["stdout"].splitlines():

                        if line.strip().startswith("cpu.time="):
                            cpu_time_2 = int(
                                line.strip().split("=")[1]
                            )
                            break

                    if cpu_time_2 is not None:

                        cpu_time_delta = (
                            cpu_time_2 - cpu_time_1
                        )

                        # virsh cpu.time is nanoseconds
                        cpu_seconds = (
                            cpu_time_delta / 1_000_000_000
                        )

                        # One second of wall time ×
                        # number of vCPUs represents
                        # 100% total capacity.
                        cpu_usage_percent = round(
                            (
                                cpu_seconds /
                                (1 * cpu_count)
                            ) * 100,
                            2
                        )

                        # Keep the value between 0 and 100.
                        cpu_usage_percent = max(
                            0,
                            min(
                                100,
                                cpu_usage_percent
                            )
                        )

    # ----------------------------------------
    # Memory
    # ----------------------------------------

    memory_max_mb = None
    memory_used_mb = None
    memory_unused_mb = None
    memory_usable_mb = None
    memory_rss_mb = None

    try:

        if "Max memory" in info:
            memory_max_mb = round(
                int(
                    info["Max memory"].split()[0]
                ) / 1024,
                2
            )

        if "Used memory" in info:
            memory_used_mb = round(
                int(
                    info["Used memory"].split()[0]
                ) / 1024,
                2
            )

    except (ValueError, IndexError):
        pass

    # ----------------------------------------
    # Get detailed memory statistics
    # ----------------------------------------

    memory_result = run_command([
        "virsh",
        "domstats",
        vm_name,
        "--balloon"
    ])

    if memory_result["success"]:

        memory_values = {}

        for line in memory_result["stdout"].splitlines():

            line = line.strip()

            if "=" in line:

                key, value = line.split("=", 1)

                try:
                    memory_values[key] = int(value)
                except ValueError:
                    pass

        # Values are reported in KiB
        if "balloon.unused" in memory_values:
            memory_unused_mb = round(
                memory_values["balloon.unused"] / 1024,
                2
            )

        if "balloon.usable" in memory_values:
            memory_usable_mb = round(
                memory_values["balloon.usable"] / 1024,
                2
            )

        if "balloon.rss" in memory_values:
            memory_rss_mb = round(
                memory_values["balloon.rss"] / 1024,
                2
            )

    # ----------------------------------------
    # Return real VM statistics
    # ----------------------------------------

    return jsonify({

        "success": True,

        "vm": vm_name,

        "status": info.get(
            "State",
            "unknown"
        ),

        "ip_address": ip_address,

        "cpu_count": cpu_count,

        "cpu_usage_percent": cpu_usage_percent,

        "memory_max_mb": memory_max_mb,

        "memory_used_mb": memory_used_mb,

        "memory_unused_mb": memory_unused_mb,

        "memory_usable_mb": memory_usable_mb,

        "memory_rss_mb": memory_rss_mb,

        "persistent": info.get(
            "Persistent"
        ),

        "autostart": info.get(
            "Autostart"
        ),

        "security_model": info.get(
            "Security model"
        ),

        "raw": info_result["stdout"]
    })

@app.route("/api/report")
def get_report():

    report_files = sorted(
        (BASE_DIR / "reports").glob("report_*.json"),
        key=lambda file: file.stat().st_mtime,
        reverse=True
    )

    if not report_files:
        return jsonify({
            "success": False,
            "error": "No scan report found"
        }), 404

    latest_report = report_files[0]

    try:
        with open(latest_report, "r") as file:
            report = json.load(file)

        return jsonify(report)

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


def load_latest_report():
    report_files = sorted(
        (BASE_DIR / "reports").glob("report_*.json"),
        key=lambda file: file.stat().st_mtime,
        reverse=True
    )

    if not report_files:
        return None, None

    latest_report = report_files[0]

    with open(latest_report, "r") as file:
        report = json.load(file)

    return report, latest_report


@app.route("/api/compliance")
def compliance():
    try:
        # Get the newest scan report
        report, report_path = load_latest_report()

        if report is None:
            return jsonify({
                "success": False,
                "error": "No scan report found"
            }), 404

        # Get hosts from the report
        hosts = report.get("hosts", {})

        # Count the actual number of rules in cis.rego
        rule_file = BASE_DIR / "opa" / "cis.rego"

        rule_text = rule_file.read_text(encoding="utf-8")

        rules_per_vm = rule_text.count("deny contains msg if")

        # Number of VMs
        vm_count = len(hosts)

        # Total checks = rules × VMs
        total_checks = rules_per_vm * vm_count

        # Count failed checks
        fail_count = sum(
            len(violations)
            for violations in hosts.values()
        )

        # Remaining checks are passing
        pass_count = max(total_checks - fail_count, 0)

        # Current scanner does not have an INFO state
        info_count = 0

        # Calculate compliance percentage
        if total_checks > 0:
            compliance_score = round(
                (pass_count / total_checks) * 100,
                2
            )
        else:
            compliance_score = 0

        # Per-VM results
        host_summary = {}

        for vm, violations in hosts.items():

            failed = len(violations)

            passed = max(
                rules_per_vm - failed,
                0
            )

            if rules_per_vm > 0:
                vm_score = round(
                    (passed / rules_per_vm) * 100,
                    2
                )
            else:
                vm_score = 0

            host_summary[vm] = {
                "checks": rules_per_vm,
                "pass": passed,
                "fail": failed,
                "info": 0,
                "compliance_score": vm_score,
                "violations": violations
            }

        return jsonify({
            "success": True,

            "framework": "CIS-aligned",

            "target": "Linux",

            "timestamp": report.get("timestamp"),

            "summary": {
                "total_checks": total_checks,
                "pass": pass_count,
                "fail": fail_count,
                "info": info_count,
                "compliance_score": compliance_score
            },

            "hosts": host_summary
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/prepare-demo", methods=["POST"])
def prepare_demo():

    result = run_command([
        "ansible-playbook",
        "-i",
        str(BASE_DIR / "ansible" / "inventory.ini"),
        str(BASE_DIR / "ansible" / "misconfigure.yml")
    ])

    return jsonify(result)

@app.route("/api/scan", methods=["POST"])
def scan():

    # Step 1: Intentionally misconfigure the VMs for the demo
    prepare_result = run_command([
        "ansible-playbook",
        "-i",
        str(BASE_DIR / "ansible" / "inventory.ini"),
        str(BASE_DIR / "ansible" / "misconfigure.yml")
    ])

    if not prepare_result["success"]:
        return jsonify({
            "success": False,
            "stage": "prepare-demo",
            "error": prepare_result
        }), 500

    # Step 2: Run the real CSPM scan
    scan_result = run_command([
        "python3",
        str(BASE_DIR / "detect.py")
    ])

    return jsonify({
        "success": scan_result["success"],
        "prepare": prepare_result,
        "scan": scan_result
    })

@app.route("/api/remediate", methods=["POST"])
def remediate():

    reports_dir = BASE_DIR / "reports"
    reports_dir.mkdir(exist_ok=True)

    # Remember reports that already existed before this remediation run.
    existing_reports = {
        p.resolve()
        for p in reports_dir.glob("report_*.json")
    }

    # Run the real CSPM remediation engine.
    result = run_command([
        "python3",
        str(BASE_DIR / "detect.py"),
        "--fix"
    ])

    if not result["success"]:
        return jsonify({
            "success": False,
            "status": "failed",
            "error": result["stderr"] or result["stdout"],
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "returncode": result["returncode"]
        }), 500

    # Find reports created by THIS remediation execution.
    new_reports = sorted(
        [
            p for p in reports_dir.glob("report_*.json")
            if p.resolve() not in existing_reports
        ],
        key=lambda p: p.stat().st_mtime
    )

    # A normal --fix run with violations should create:
    #   1. BEFORE report
    #   2. AFTER verification report
    if len(new_reports) >= 2:

        before_path = new_reports[-2]
        after_path = new_reports[-1]

    elif len(new_reports) == 1:

        # No remediation was necessary, so detect.py only created
        # one report.
        before_path = new_reports[0]
        after_path = new_reports[0]

    else:
        return jsonify({
            "success": False,
            "status": "failed",
            "error": "No new CSPM report was generated."
        }), 500

    try:
        with open(before_path, "r") as f:
            before_report = json.load(f)

        with open(after_path, "r") as f:
            after_report = json.load(f)

    except (OSError, json.JSONDecodeError) as e:
        return jsonify({
            "success": False,
            "status": "failed",
            "error": f"Unable to read remediation reports: {e}"
        }), 500

    before_total = int(
        before_report.get("total_violations", 0)
    )

    after_total = int(
        after_report.get("total_violations", 0)
    )

    before_hosts = before_report.get("hosts", {})
    after_hosts = after_report.get("hosts", {})

    before_affected_vms = sum(
        1 for violations in before_hosts.values()
        if violations
    )

    after_affected_vms = sum(
        1 for violations in after_hosts.values()
        if violations
    )

    fixes_applied = max(
        before_total - after_total,
        0
    )

    verification = after_total == 0

    if verification:
        status = "completed"
    elif fixes_applied > 0:
        status = "partial"
    else:
        status = "failed"

    return jsonify({
        "success": True,
        "status": status,

        "before": {
            "total_violations": before_total,
            "affected_vms": before_affected_vms
        },

        "after": {
            "total_violations": after_total,
            "affected_vms": after_affected_vms
        },

        "fixes_applied": fixes_applied,
        "remaining_violations": after_total,
        "verification": verification,

        "before_report": str(before_path.name),
        "after_report": str(after_path.name),

        "stdout": result["stdout"],
        "stderr": result["stderr"]
    })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
