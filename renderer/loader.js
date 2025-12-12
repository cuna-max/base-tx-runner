// Script loader - ensures ethers.js is loaded before app.js
// ethers.js is loaded via preload.js from npm package

function loadApp() {
  if (typeof ethers === "undefined") {
    console.error("ethers.js가 로드되지 않았습니다.");
    handleEthersError();
    return;
  }
  // Load app.js after ethers is ready
  const script = document.createElement("script");
  script.src = "app.js";
  script.onerror = function () {
    const errorBanner = document.getElementById("error-banner");
    if (errorBanner) {
      errorBanner.textContent = "오류: app.js를 로드할 수 없습니다.";
      errorBanner.classList.remove("hidden");
    }
  };
  document.body.appendChild(script);
}

function handleEthersError() {
  const errorBanner = document.getElementById("error-banner");
  if (errorBanner) {
    errorBanner.textContent =
      "오류: ethers.js를 로드할 수 없습니다. 앱을 다시 시작해주세요.";
    errorBanner.classList.remove("hidden");
  }
}

// Wait for ethers.js to be available from preload.js
(function () {
  function checkAndLoad() {
    // Check if ethers is available directly or via getter
    let ethersObj = null;
    if (typeof ethers !== "undefined") {
      ethersObj = ethers;
    } else if (typeof getEthers === "function") {
      ethersObj = getEthers();
      // Make it available globally
      window.ethers = ethersObj;
    }

    if (ethersObj) {
      console.log("ethers found:", typeof ethersObj);
      console.log("ethers.Wallet:", typeof ethersObj?.Wallet);
      console.log("ethers.JsonRpcProvider:", typeof ethersObj?.JsonRpcProvider);
      loadApp();
    } else {
      console.log("Waiting for ethers...");
      // Wait a bit more if not ready yet
      setTimeout(checkAndLoad, 100);
    }
  }

  // Check immediately
  if (typeof ethers !== "undefined" || typeof getEthers === "function") {
    console.log("ethers already available");
    checkAndLoad();
  } else {
    console.log("ethers not yet available, waiting...");
    // Wait for DOM to be ready, then check
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", checkAndLoad);
    } else {
      checkAndLoad();
    }

    // Timeout after 5 seconds
    setTimeout(function () {
      if (typeof ethers === "undefined" && typeof getEthers !== "function") {
        console.error("ethers still not available after 5 seconds");
        handleEthersError();
      }
    }, 5000);
  }
})();
