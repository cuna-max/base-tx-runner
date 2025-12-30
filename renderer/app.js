// Base TX Runner - Main Application Logic
// Vanilla JavaScript for Electron renderer process

// ethers.js is loaded via preload.js from npm package
// Use global ethers object exposed by preload.js

// Check if ethers is loaded
if (typeof ethers === "undefined") {
  console.error("ethers.js가 로드되지 않았습니다.");
  document.addEventListener("DOMContentLoaded", function () {
    const errorBanner = document.getElementById("error-banner");
    if (errorBanner) {
      errorBanner.textContent =
        "오류: ethers.js를 로드할 수 없습니다. 앱을 다시 시작해주세요.";
      errorBanner.classList.remove("hidden");
    }
  });
  throw new Error("ethers.js is not loaded");
}

// ============================================================================
// DOM Helpers
// ============================================================================

function $(id) {
  return document.getElementById(id);
}

function showError(message) {
  const banner = $("error-banner");
  banner.textContent = message;
  banner.classList.remove("hidden");
  banner.className = "error-banner";
  setTimeout(() => {
    banner.classList.add("hidden");
  }, 5000);
}

function showSuccess(message) {
  const banner = $("error-banner");
  banner.textContent = message;
  banner.classList.remove("hidden");
  banner.className = "error-banner success-banner";
  setTimeout(() => {
    banner.classList.add("hidden");
  }, 5000);
}

function updateConnectionStatus(message, isConnected = false, isError = false) {
  const status = $("connection-status");
  status.textContent = message;
  status.className = "connection-status";
  if (isConnected) {
    status.classList.add("connected");
  } else if (isError) {
    status.classList.add("error");
  }
}

function addLog(index, status, hashOrError) {
  const container = $("logs-container");
  const entry = document.createElement("div");
  entry.className = `log-entry ${status.toLowerCase()}`;

  const indexSpan = document.createElement("span");
  indexSpan.className = "log-index";
  indexSpan.textContent = `#${index}`;

  const statusSpan = document.createElement("span");
  statusSpan.className = "log-status";
  statusSpan.textContent = status;

  const hashSpan = document.createElement("span");
  hashSpan.className = "log-hash";

  const timestamp = new Date().toLocaleTimeString();

  if (status === "SUCCESS" && hashOrError) {
    const truncatedHash = `${hashOrError.substring(
      0,
      10
    )}...${hashOrError.substring(hashOrError.length - 8)}`;
    hashSpan.textContent = `${truncatedHash} [${timestamp}]`;
    entry.title = `클릭하여 Basescan에서 확인: ${hashOrError}`;
    entry.addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(
          `https://basescan.org/tx/${hashOrError}`
        );
      } else {
        window.open(`https://basescan.org/tx/${hashOrError}`, "_blank");
      }
    });
  } else if (status === "FAILED") {
    hashSpan.textContent = `${hashOrError || "알 수 없는 오류"} [${timestamp}]`;
  } else if (status === "SENDING") {
    hashSpan.textContent = `${hashOrError || "전송 중..."} [${timestamp}]`;
  } else {
    hashSpan.textContent = `${hashOrError || "대기 중..."} [${timestamp}]`;
  }

  entry.appendChild(indexSpan);
  entry.appendChild(statusSpan);
  entry.appendChild(hashSpan);

  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function updateLog(index, status, hashOrError) {
  const container = $("logs-container");
  const entries = container.querySelectorAll(".log-entry");
  if (entries[index]) {
    const entry = entries[index];
    entry.className = `log-entry ${status.toLowerCase()}`;

    const statusSpan = entry.querySelector(".log-status");
    const hashSpan = entry.querySelector(".log-hash");

    if (statusSpan) statusSpan.textContent = status;

    if (status === "SUCCESS" && hashOrError) {
      const truncatedHash = `${hashOrError.substring(
        0,
        10
      )}...${hashOrError.substring(hashOrError.length - 8)}`;
      hashSpan.textContent = truncatedHash;
      entry.title = `클릭하여 Basescan에서 확인: ${hashOrError}`;
      entry.style.cursor = "pointer";
      entry.addEventListener("click", () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(
            `https://basescan.org/tx/${hashOrError}`
          );
        } else {
          window.open(`https://basescan.org/tx/${hashOrError}`, "_blank");
        }
      });
    } else if (status === "FAILED") {
      hashSpan.textContent = hashOrError || "알 수 없는 오류";
      entry.style.cursor = "default";
    }
  }
}

function updateStatus(planned, sent, confirmed, failed) {
  $("planned-count").textContent = planned;
  $("sent-count").textContent = sent;
  $("confirmed-count").textContent = confirmed;
  $("failed-count").textContent = failed;

  const progress = planned > 0 ? (confirmed / planned) * 100 : 0;
  $("progress-fill").style.width = `${progress}%`;
  $("progress-text").textContent = `성공: ${confirmed} / 목표: ${planned}`;
}

// ============================================================================
// Validation Functions
// ============================================================================

function isValidAddress(address) {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

function validateInputs() {
  const targetAddress = $("target-address").value.trim();
  const txCount = parseInt($("tx-count").value);
  const txValue = parseFloat($("tx-value").value);
  const gasPrice = parseFloat($("gas-price").value);
  const delay = parseInt($("delay").value);
  const maxPending = parseInt($("max-pending").value);

  const errors = [];

  // Validate target address
  if (!targetAddress) {
    errors.push("대상 주소를 입력해주세요.");
    $("target-address-error").textContent = "대상 주소를 입력해주세요.";
    $("target-address-error").classList.remove("hidden");
  } else if (!isValidAddress(targetAddress)) {
    errors.push("유효하지 않은 주소 형식입니다.");
    $("target-address-error").textContent = "유효하지 않은 주소 형식입니다.";
    $("target-address-error").classList.remove("hidden");
  } else {
    $("target-address-error").classList.add("hidden");
  }

  // Validate transaction count
  if (isNaN(txCount) || txCount < 1 || txCount > 2000) {
    errors.push("트랜잭션 수는 1-2000 사이여야 합니다.");
  }

  // Validate transaction value
  if (isNaN(txValue) || txValue < 0) {
    errors.push("트랜잭션 값은 0 이상이어야 합니다.");
  }

  // Validate gas price
  if (isNaN(gasPrice) || gasPrice < 0) {
    errors.push("Gas 가격은 0 이상이어야 합니다.");
  } else if (gasPrice < 0.01) {
    $("gas-price-warning").textContent =
      "경고: Gas 가격이 매우 낮습니다. 트랜잭션이 처리되지 않을 수 있습니다.";
    $("gas-price-warning").classList.remove("hidden");
  } else {
    $("gas-price-warning").classList.add("hidden");
  }

  // Validate delay
  if (isNaN(delay) || delay < 0) {
    errors.push("지연 시간은 0 이상이어야 합니다.");
  }

  // Validate max pending
  if (isNaN(maxPending) || maxPending < 1) {
    errors.push("최대 대기 중 트랜잭션 수는 1 이상이어야 합니다.");
  }

  if (errors.length > 0) {
    showError(errors.join(" "));
    return false;
  }

  return true;
}

function estimateGasCost(txCount, gasPriceGwei) {
  // Base transaction gas limit is typically 21000
  const GAS_LIMIT_PER_TX = 21000n;
  const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), "gwei");
  const totalGasWei = BigInt(txCount) * GAS_LIMIT_PER_TX * gasPriceWei;
  const totalGasEth = ethers.formatEther(totalGasWei);
  return totalGasEth;
}

function updateGasEstimate() {
  const txCount = parseInt($("tx-count").value) || 0;
  const gasPrice = parseFloat($("gas-price").value) || 0;

  if (txCount > 0 && gasPrice > 0) {
    const estimatedCost = estimateGasCost(txCount, gasPrice);
    const estimateEl = $("gas-estimate");
    estimateEl.textContent = `예상 총 Gas 비용: 약 ${parseFloat(
      estimatedCost
    ).toFixed(6)} ETH`;
    estimateEl.classList.remove("hidden");
  } else {
    $("gas-estimate").classList.add("hidden");
  }
}

// ============================================================================
// Blockchain/Ethers Helpers
// ============================================================================

let providerId = null;
let walletId = null;

async function connectWallet() {
  console.log("connectWallet called");

  const rpcUrl = $("rpc-url").value.trim();
  const privateKey = $("private-key").value.trim();

  console.log("RPC URL:", rpcUrl ? "provided" : "missing");
  console.log("Private Key:", privateKey ? "provided" : "missing");

  if (!rpcUrl) {
    updateConnectionStatus("RPC URL을 입력해주세요.", false, true);
    return;
  }

  if (!privateKey) {
    updateConnectionStatus("Private Key를 입력해주세요.", false, true);
    return;
  }

  console.log("Checking ethers availability...");
  if (typeof ethers === "undefined") {
    console.error("ethers is not defined!");
    updateConnectionStatus(
      "오류: ethers.js가 로드되지 않았습니다.",
      false,
      true
    );
    return;
  }

  console.log("ethers available:", typeof ethers);
  console.log("ethers.createProvider:", typeof ethers?.createProvider);

  try {
    // Create provider using wrapper function
    providerId = ethers.createProvider(rpcUrl);
    console.log("Provider created with ID:", providerId);

    // Test connection
    const blockNumber = await ethers.providerGetBlockNumber(providerId);
    console.log("Connected to block:", blockNumber);

    // Create wallet
    walletId = ethers.createWallet(privateKey, providerId);
    console.log("Wallet created with ID:", walletId);

    // Get wallet address
    const walletAddress = ethers.walletGetAddress(walletId);
    console.log("Wallet address:", walletAddress);

    // Get balance
    const balance = await ethers.providerGetBalance(providerId, walletAddress);
    const balanceEth = ethers.formatEther(balance);

    updateConnectionStatus(
      `연결됨: ${walletAddress}\n잔액: ${parseFloat(balanceEth).toFixed(
        6
      )} ETH`,
      true,
      false
    );

    // Show success message
    showSuccess(
      "✅ 지갑 연결이 완료되었습니다. 트랜잭션 전송을 시작할 수 있습니다."
    );

    // Enable start button
    $("start-btn").disabled = false;

    // Update gas estimate when balance is known
    updateGasEstimate();
  } catch (error) {
    console.error("Connection error:", error);
    updateConnectionStatus(`연결 실패: ${error.message}`, false, true);
    providerId = null;
    walletId = null;
    $("start-btn").disabled = true;
  }
}

// ============================================================================
// Transaction Sending Logic
// ============================================================================

let isRunning = false;
let shouldStop = false;
let stats = {
  planned: 0,
  sent: 0,
  confirmed: 0,
  failed: 0,
};

// Track pending transactions
const pendingTxs = new Map();

async function waitForConfirmation(txHash, index) {
  try {
    if (!providerId) {
      throw new Error("Provider not initialized");
    }
    const receipt = await ethers.providerWaitForTransaction(providerId, txHash);
    pendingTxs.delete(txHash);

    if (receipt.status === 1) {
      stats.confirmed++;
      addLog(index, "SUCCESS", txHash);
    } else {
      stats.failed++;
      addLog(index, "FAILED", "트랜잭션 실패");
    }

    updateStatus(stats.planned, stats.sent, stats.confirmed, stats.failed);
  } catch (error) {
    pendingTxs.delete(txHash);
    stats.failed++;
    addLog(index, "FAILED", error.message || "확인 실패");
    updateStatus(stats.planned, stats.sent, stats.confirmed, stats.failed);
  }
}

async function sendTransaction(index, targetAddress, valueEth, gasPriceGwei) {
  if (!walletId) {
    throw new Error("Wallet not initialized");
  }

  const valueWei = ethers.parseEther(valueEth.toString());
  const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), "gwei");

  const tx = {
    to: targetAddress,
    value: valueWei,
    data: "0x",
    gasPrice: gasPriceWei,
  };

  try {
    // Send transaction using wrapper function
    addLog(index, "SENDING", "전송 중...");
    const txResponse = await ethers.walletSendTransaction(walletId, tx);
    const txHash = txResponse.hash;

    stats.sent++;
    addLog(index, "PENDING", txHash);
    updateStatus(stats.planned, stats.sent, stats.confirmed, stats.failed);

    // Track pending transaction
    pendingTxs.set(txHash, { index, txResponse });

    // Wait for confirmation in background
    waitForConfirmation(txHash, index).catch((err) => {
      console.error(`Error waiting for confirmation for tx ${index}:`, err);
    });

    return txHash;
  } catch (error) {
    stats.failed++;
    const errorMsg = error.message || "전송 실패";
    addLog(index, "FAILED", errorMsg);
    updateStatus(stats.planned, stats.sent, stats.confirmed, stats.failed);
    throw error;
  }
}

async function runTransactionLoop() {
  console.log("runTransactionLoop called");
  console.log("walletId:", walletId);
  console.log("providerId:", providerId);

  if (!walletId || !providerId) {
    console.error("Wallet or provider not initialized");
    showError("먼저 지갑을 연결해주세요.");
    return;
  }

  if (!validateInputs()) {
    return;
  }

  // Get configuration
  const targetAddress = $("target-address").value.trim();
  const txCount = parseInt($("tx-count").value);
  const txValue = parseFloat($("tx-value").value);
  const gasPrice = parseFloat($("gas-price").value);
  const delay = parseInt($("delay").value);
  const maxPending = parseInt($("max-pending").value);

  // Reset stats
  stats = {
    planned: txCount,
    sent: 0,
    confirmed: 0,
    failed: 0,
  };

  // Clear logs
  $("logs-container").innerHTML = "";

  // Update UI
  isRunning = true;
  shouldStop = false;
  updateStatus(stats.planned, stats.sent, stats.confirmed, stats.failed);

  // Disable inputs
  $("rpc-url").disabled = true;
  $("private-key").disabled = true;
  $("connect-btn").disabled = true;
  $("target-address").disabled = true;
  $("tx-count").disabled = true;
  $("tx-value").disabled = true;
  $("gas-price").disabled = true;
  $("delay").disabled = true;
  $("max-pending").disabled = true;
  $("start-btn").disabled = true;
  $("stop-btn").disabled = false;

  // Send transactions sequentially to avoid nonce conflicts
  // Even though we have maxPending, we'll send them one by one to ensure nonce order
  let currentIndex = 0;
  let lastSentNonce = null;

  while (stats.confirmed < txCount && !shouldStop) {
    // Wait if we have too many pending transactions
    while (pendingTxs.size >= maxPending && !shouldStop) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (shouldStop) {
      break;
    }

    try {
      // Send transaction sequentially to avoid nonce conflicts
      await sendTransaction(currentIndex + 1, targetAddress, txValue, gasPrice);
      currentIndex++;

      // Delay between transactions to ensure proper nonce ordering
      if (stats.confirmed < txCount && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Error sending transaction ${currentIndex + 1}:`, error);
      currentIndex++; // Increment index even on failure to keep log numbers sequential

      // Continue with next transaction even if one fails
      // Add delay to avoid rapid retries
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Wait for all pending transactions to complete
  while (pendingTxs.size > 0 && !shouldStop) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Re-enable inputs
  isRunning = false;
  $("rpc-url").disabled = false;
  $("private-key").disabled = false;
  $("connect-btn").disabled = false;
  $("target-address").disabled = false;
  $("tx-count").disabled = false;
  $("tx-value").disabled = false;
  $("gas-price").disabled = false;
  $("delay").disabled = false;
  $("max-pending").disabled = false;
  $("start-btn").disabled = false;
  $("stop-btn").disabled = true;

  if (shouldStop) {
    showError("전송이 중지되었습니다.");
  } else {
    showSuccess(`완료: ${stats.confirmed}개 성공, ${stats.failed}개 실패`);
  }
}

function stopSending() {
  shouldStop = true;
  $("stop-btn").disabled = true;
}

// ============================================================================
// Event Listeners
// ============================================================================

function initializeEventListeners() {
  // Connect button
  const connectBtn = $("connect-btn");
  if (connectBtn) {
    connectBtn.addEventListener("click", connectWallet);
    console.log("Connect button event listener attached");
  } else {
    console.error("Connect button not found!");
  }

  // Start button
  const startBtn = $("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", runTransactionLoop);
  }

  // Stop button
  const stopBtn = $("stop-btn");
  if (stopBtn) {
    stopBtn.addEventListener("click", stopSending);
  }

  // Update gas estimate when relevant inputs change
  const txCountInput = $("tx-count");
  if (txCountInput) {
    txCountInput.addEventListener("input", updateGasEstimate);
  }

  const gasPriceInput = $("gas-price");
  if (gasPriceInput) {
    gasPriceInput.addEventListener("input", updateGasEstimate);
  }

  // Validate target address on input
  const targetAddressInput = $("target-address");
  if (targetAddressInput) {
    targetAddressInput.addEventListener("input", () => {
      const address = targetAddressInput.value.trim();
      if (address && !isValidAddress(address)) {
        $("target-address-error").textContent =
          "유효하지 않은 주소 형식입니다.";
        $("target-address-error").classList.remove("hidden");
      } else {
        $("target-address-error").classList.add("hidden");
      }
    });
  }

  // Allow Enter key to connect
  const privateKeyInput = $("private-key");
  if (privateKeyInput) {
    privateKeyInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        connectWallet();
      }
    });
  }
}

// Initialize event listeners when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeEventListeners);
} else {
  // DOM is already ready, initialize immediately
  initializeEventListeners();
}
