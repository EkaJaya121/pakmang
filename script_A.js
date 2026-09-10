const x_data = () => {
  return {
    currentScreen: "menu",
    currentMode: "monitoring",
    // login state
    loginUsername: "",
    loginPassword: "",
    correctUsername: "krakatau",
    correctPassword: "andover",

    ipAddress: "https://api.krakatauandover.my.id",
    // ipAddress: "http://192.168.0.112:5001",
    realtimeData: true,

    // Interval polling (menggantikan socket.io, mengikuti pola CONFIG.POLL_INTERVALS)
    pollIntervals: {
      context: 1000, // = CONFIG.POLL_INTERVALS.TELEMETRY
      cameraRefresh: 1000, // = CONFIG.POLL_INTERVALS.SNAPSHOTS
    },
    contextFetchInProgress: false,
    currentDate: moment().format("YYYY-MM-DD"),
    currentTime: moment().format("HH:mm"),

    surfaceCamera: {
      streamUrl: "",
      waypointsText: "",
      waypoints: [],
      image: "",
      refreshImage: 0,
      refreshStream: 0,
    },

    underwaterCamera: {
      streamUrl: "",
      waypointsText: "",
      waypoints: [],
      image: "",
      refreshImage: 0,
      refreshStream: 0,
    },

    vehicleData: {
      altitude: 0,
      lat: 0,
      lon: 0,

      // Alias supaya kode lama tetap bisa menggunakan field ini
      alt: 0,
      long: 0,

      course: null,
      cog: null,

      heading: null,
      yaw: 0,

      speed_mps: 0,
      speed_kmh: 0,
      speed_knots: 0,

      // Alias lama
      sog: 0,

      gcs_active: false,
      app_connect: false,

      fix: false,
      gps_valid: false,
      gps_last_error: null,
      gps_last_nmea: "",
      gps_last_nmea_at: 0,
      gps_reader_baud: 0,
      gps_reader_port: "",
      gps_reader_status: "",

      hdop: 0,
      satellites: 0,
      gps_speed_mps: 0,

      heartbeat_age: 0,

      left_rpm: 0,
      right_rpm: 0,
      motor_data_age: 0,
      motor_direction: "",
      motor_speed_mps: 0,
      motor_updated_at: 0,

      session_id: "",
      timestamp: "",

      // Tetap dipertahankan kalau UI lama masih menggunakannya
      date: "",
      time: "",
      is_armable: false,
      last_heartbeat: "",
      mode: "",
      pitch: 0,
      roll: 0,

      surface_camera_connect: false,
      underwater_camera_connect: false,

      current_wp: 0,
    },

    // GPS Tracker properties
    gpsTracker: {
      canvas: null,
      ctx: null,
      ctxPattern: null,
      canvasPattern: null,
      watchId: null,
      originGPS: null,
      path: [],
      totalDistance: 0,
      startTime: null,
      lastUpdateTime: null,
      pixelsPerMeter: 17,
      CANVAS_SIZE: 600,
      MARGIN: 40,
      EARTH_RADIUS: 6371000,
      isTracking: false,
      wakeLock: null,
      retryCount: 0,

      shipImage: null,
      shipImageLoaded: false,
      shipImageSize: 68,
    },

    async init() {
      // Inisialisasi GPS Tracker Canvas
      this.initGPSCanvas();

      // Langsung mulai GPS tracking & kamera tanpa handshake port/baudrate,
      // mengikuti pola GCSApp.init(): CameraManager & GPSRenderer langsung
      // dijalankan, status koneksi ditentukan dari hasil fetch data itu sendiri.
      this.startGPSTracking();
      try {
        await this.startSurfaceCamera();
      } catch (e) {
        console.warn("Failed to start surface camera:", e.message);
      }
      try {
        await this.startUnderwaterCamera();
      } catch (e) {
        console.warn("Failed to start underwater camera:", e.message);
      }

      // Polling data kendaraan via fetch (menggantikan socket.io + axios),
      // mengikuti pola GPSData.fetch(): fetchInProgress guard + AbortController timeout.
      this.fetchContext();
      setInterval(() => this.fetchContext(), this.pollIntervals.context);

      // Refresh snapshot terakhir secara berkala, terpisah dari polling context
      // (mengikuti pola CameraManager.refreshLatestSnapshots()).
      this.refreshLatestImages();
      setInterval(() => this.refreshLatestImages(), this.pollIntervals.cameraRefresh);

      // Update jam dan tanggal
      setInterval(() => {
        this.currentDate = moment().format("YYYY-MM-DD");
        this.currentTime = moment().format("HH:mm:ss");
      }, 1000);

      // toastr config
      toastr.options = {
        closeButton: true,
        progressBar: true,
        positionClass: "toast-top-right",
        timeOut: "5000",
      };

      // Request wake lock untuk GPS tracking
      this.requestWakeLock();
    },

    // ========== EXISTING METHODS ==========
    async selectMonitoring() {
      this.currentMode = "monitoring";
      this.currentScreen = "dashboard";
      toastr.info("Monitoring mode activated");
    },

    async showLogin() {
      this.currentScreen = "login";
      this.loginUsername = "";
      this.loginPassword = "";
    },

    async login() {
      if (this.loginUsername === this.correctUsername && this.loginPassword === this.correctPassword) {
        this.currentMode = "control";
        this.currentScreen = "dashboard";
        toastr.success("Login successful! Control mode activated");
      } else {
        toastr.error("Invalid username or password!");
      }
    },

    async logout() {
      this.currentScreen = "menu";
      this.currentMode = "monitoring";
      this.loginUsername = "";
      this.loginPassword = "";
      toastr.info("Logged out successfully");
    },

    async backToMenu() {
      this.currentScreen = "menu";
    },

    async connectGcs() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          app_connect: true,
        });
        toastr.success("GCS connected successfully!", "Success");
        return true;
      } catch (error) {
        toastr.error("Failed to connect GCS", "Error");
        return false;
      }
    },

    async disconnectGcs() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          app_connect: false,
        });
        toastr.success("GCS disconnected successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to disconnect GCS", "Error");
      }
    },

    // ===================== Data Fetching (pola fetch, bukan axios/socket.io) =====================
    async fetchContext() {
      if (!this.realtimeData || this.contextFetchInProgress) return;

      this.contextFetchInProgress = true;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      try {
        const response = await fetch(`${this.ipAddress}/telemetry`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();

        /*
        * =========================================================
        * NORMALISASI DATA API TELEMETRY
        * =========================================================
        */

        this.vehicleData = {
          ...payload,

          // GPS
          lat: payload.lat ?? 0,
          lon: payload.lon ?? 0,

          // Alias untuk kode lama
          long: payload.lon ?? 0,

          // Altitude
          altitude: payload.altitude ?? 0,
          alt: payload.altitude ?? 0,

          // Heading
          heading: payload.heading,
          yaw: payload.heading ?? 0,

          // Course
          course: payload.course,
          cog: payload.course ?? 0,

          // Speed
          speed_mps: payload.speed_mps ?? 0,
          speed_kmh: payload.speed_kmh ?? 0,
          speed_knots: payload.speed_knots ?? 0,

          // Alias SOG lama
          sog: payload.speed_knots ?? 0,

          // GCS
          gcs_active: payload.gcs_active ?? false,
          app_connect: true,

          // GPS status
          fix: payload.fix ?? false,
          gps_valid: payload.gps_valid ?? false,

          // Field lama yang tidak tersedia di API
          current_wp: this.vehicleData.current_wp ?? 0,

          surface_camera_connect:
            this.surfaceCamera.streamUrl !== "",

          underwater_camera_connect:
            this.underwaterCamera.streamUrl !== "",
        };

        /*
        * =========================================================
        * UPDATE GPS
        * =========================================================
        */

        this.updateGPSFromVehicle();

        /*
        * =========================================================
        * AUTO WAYPOINT CAPTURE
        * =========================================================
        *
        * Hanya dijalankan jika current_wp memang tersedia
        * dari backend.
        */

        if (
          payload.current_wp !== undefined &&
          payload.current_wp !== null
        ) {
          await this.waypointCaptureSurfaceAuto();
          await this.waypointCaptureUnderwaterAuto();
        }

      } catch (error) {
        console.warn(
          "Gagal ambil data telemetry:",
          error.message
        );

        this.vehicleData.app_connect = false;
        this.vehicleData.gcs_active = false;

      } finally {
        clearTimeout(timeoutId);
        this.contextFetchInProgress = false;
      }
    },

    updateCameraConnectionState() {
      this.surfaceCamera.streamUrl = this.vehicleData.surface_camera_connect
        ? `${this.ipAddress}/surface_feed?ts=${Date.now()}`
        : "";

      this.underwaterCamera.streamUrl = this.vehicleData.underwater_camera_connect
        ? `${this.ipAddress}/underwater_feed?ts=${Date.now()}`
        : "";
    },

    refreshLatestImages() {
      const timestamp = Date.now();
      this.surfaceCamera.image = `${this.ipAddress}/api/latest-photo/surface?ts=${timestamp}`;
      this.underwaterCamera.image = `${this.ipAddress}/api/latest-photo/underwater?ts=${timestamp}`;
    },

    async saveSurfaceWaypoints() {
      if (this.surfaceCamera.waypointsText === "") {
        toastr.error("Waypoints for surface camera cannot be empty", "Error");
        return;
      }
      try {
        this.surfaceCamera.waypoints = this.surfaceCamera.waypointsText.split(" ");
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          surface_camera_waypoints: this.surfaceCamera.waypoints,
        });
        toastr.success("Waypoints for surface camera saved successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to save waypoints for surface camera", "Error");
      }
    },

    async startSurfaceCamera() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          surface_camera_connect: true,
        });
        this.surfaceCamera.refreshStream += 1;
        this.surfaceCamera.streamUrl = `${this.ipAddress}/surface_feed?refresh=${this.surfaceCamera.refreshStream}`;
        toastr.success("Surface camera started successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to start surface camera", "Error");
      }
    },

    async stopSurfaceCamera() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          surface_camera_connect: false,
        });
        this.surfaceCamera.streamUrl = "";
        toastr.success("Surface camera stopped successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to stop surface camera", "Error");
      }
    },

    async captureSurfaceImage() {
      try {
        const response = await axios.get(`${this.ipAddress}/camera/surface-capture`);
        this.surfaceCamera.refreshImage += 1;
        this.surfaceCamera.image = `${this.ipAddress}/api/latest-photo/surface?refresh=${this.surfaceCamera.refreshImage}`;
        toastr.success("Image for surface camera captured successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to capture surface image", "Error");
      }
    },

    async startUnderwaterCamera() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          underwater_camera_connect: true,
        });
        this.underwaterCamera.refreshStream += 1;
        this.underwaterCamera.streamUrl = `${this.ipAddress}/underwater_feed?refresh=${this.underwaterCamera.refreshStream}`;
        toastr.success("Underwater camera started successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to start underwater camera", "Error");
      }
    },

    async stopUnderwaterCamera() {
      try {
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          underwater_camera_connect: false,
        });
        this.underwaterCamera.streamUrl = "";
        toastr.success("Underwater camera stopped successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to stop underwater camera", "Error");
      }
    },

    async saveUnderwaterWaypoints() {
      if (this.underwaterCamera.waypointsText === "") {
        toastr.error("Waypoints for underwater camera cannot be empty", "Error");
        return;
      }
      try {
        this.underwaterCamera.waypoints = this.underwaterCamera.waypointsText.split(" ");
        const response = await axios.post(`${this.ipAddress}/telemetry`, {
          underwater_camera_waypoints: this.underwaterCamera.waypoints,
        });
        toastr.success("Waypoints for underwater camera saved successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to save waypoints for underwater camera", "Error");
      }
    },

    async captureUnderwaterImage() {
      try {
        const response = await axios.get(`${this.ipAddress}/camera/underwater-capture`);
        this.underwaterCamera.refreshImage += 1;
        this.underwaterCamera.image = `${this.ipAddress}/camera/underwater-latest?refresh=${this.underwaterCamera.refreshImage}`;
        toastr.success("Image for underwater camera captured successfully!", "Success");
      } catch (error) {
        toastr.error("Failed to capture underwater image", "Error");
      }
    },

    async waypointCaptureSurfaceAuto() {
      try {
        const currentWP = this.vehicleData.current_wp;
        const waypoints = this.surfaceCamera.waypoints;

        if (!waypoints || waypoints.length === 0) return;

        if (waypoints.includes(String(currentWP))) {
          console.log(`📸 Waypoint ${currentWP} matched – taking surface photo`);
          await this.captureSurfaceImage();

          this.surfaceCamera.waypoints = this.surfaceCamera.waypoints.filter((wp) => wp !== String(currentWP));
          this.surfaceCamera.waypointsText = this.surfaceCamera.waypoints.join(" ");
          toastr.success(`Auto-captured image for surface waypoint ${currentWP}!`);
        }
      } catch (error) {
        console.error(error);
        toastr.error("Failed to auto-capture surface image", "Error");
      }
    },

    async waypointCaptureUnderwaterAuto() {
      try {
        const currentWP = this.vehicleData.current_wp;
        const waypoints = this.underwaterCamera.waypoints;

        if (!waypoints || waypoints.length === 0) return;

        if (waypoints.includes(String(currentWP))) {
          console.log(`📸 Waypoint ${currentWP} matched – taking underwater photo`);
          await this.captureUnderwaterImage();

          this.underwaterCamera.waypoints = this.underwaterCamera.waypoints.filter((wp) => wp !== String(currentWP));
          this.underwaterCamera.waypointsText = this.underwaterCamera.waypoints.join(" ");
          toastr.success(`Auto-captured image for underwater waypoint ${currentWP}!`);
        }
      } catch (error) {
        console.error(error);
        toastr.error("Failed to auto-capture underwater image", "Error");
      }
    },

    async saveSurfaceImage() {
      try {
        const imageUrl = this.surfaceCamera.image;

        if (!imageUrl || imageUrl === "") {
          toastr.warning("No surface image to save", "Warning");
          return;
        }
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch image");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
        a.download = `surface_image_${timestamp}.jpg`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toastr.success("Surface image saved successfully!", "Success");
      } catch (error) {
        console.error("Save surface image error:", error);
        toastr.error("Failed to save surface image", "Error");
      }
    },

    async deleteSurfaceImage() {
      try {
        if (!confirm("Are you sure you want to delete the surface image?")) {
          return;
        }
        try {
          await axios.delete(`${this.ipAddress}/camera/surface-latest`);
        } catch (apiError) {
          console.warn("Server delete failed, deleting locally only:", apiError.message);
        }
        this.surfaceCamera.image = "";
        this.surfaceCamera.refreshImage = 0;

        toastr.success("Surface image deleted successfully!", "Success");
      } catch (error) {
        console.error("Delete surface image error:", error);
        toastr.error("Failed to delete surface image", "Error");
      }
    },

    async saveUnderwaterImage() {
      try {
        const imageUrl = this.underwaterCamera.image;

        if (!imageUrl || imageUrl === "") {
          toastr.warning("No underwater image to save", "Warning");
          return;
        }
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch image");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
        a.download = `underwater_image_${timestamp}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toastr.success("Underwater image saved successfully!", "Success");
      } catch (error) {
        console.error("Save underwater image error:", error);
        toastr.error("Failed to save underwater image", "Error");
      }
    },

    async deleteUnderwaterImage() {
      try {
        if (!confirm("Are you sure you want to delete the underwater image?")) {
          return;
        }
        try {
          await axios.delete(`${this.ipAddress}/camera/underwater-latest`);
        } catch (apiError) {
          console.warn("Server delete failed, deleting locally only:", apiError.message);
        }
        this.underwaterCamera.image = "";
        this.underwaterCamera.refreshImage = 0;

        toastr.success("Underwater image deleted successfully!", "Success");
      } catch (error) {
        console.error("Delete underwater image error:", error);
        toastr.error("Failed to delete underwater image", "Error");
      }
    },

    // ===================== GPS Tracker =====================
    initGPSCanvas() {
      const canvas = document.getElementById("gpsCanvas");
      if (!canvas) {
        console.log("Canvas not found, retrying...");
        setTimeout(() => this.initGPSCanvas(), 500);
        return;
      }

      this.gpsTracker.canvas = canvas;
      this.gpsTracker.ctx = canvas.getContext("2d");

      // Responsive canvas sizing
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth;
      const size = 600;

      canvas.width = size;
      canvas.height = size;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      this.gpsTracker.shipImage = new Image();
      this.gpsTracker.shipImage.onload = () => {
        this.gpsTracker.shipImageLoaded = true;
        this.drawGPSCanvas(); // redraw setelah gambar siap
      };
      this.gpsTracker.shipImage.src = "/img/kapal.png";
      this.drawGPSCanvas();
      console.log("GPS Tracker initialized - Canvas size:", size);

      // Redraw on window resize
      window.addEventListener("resize", () => {
        const newSize = 600;
        const canvas = this.gpsTracker.canvas;
        if (Math.abs(canvas.width - newSize) > 50) {
          canvas.width = newSize;
          canvas.height = newSize;
          this.drawGPSCanvas();
        }
      });
    },

    gpsToLocalXY(lat, lon) {
      if (!this.gpsTracker.originGPS) return { x: 0, y: 0 };

      const dLat = lat - this.gpsTracker.originGPS.lat;
      const dLon = lon - this.gpsTracker.originGPS.lon;
      const x = dLon * (Math.PI / 180) * this.gpsTracker.EARTH_RADIUS * Math.cos((this.gpsTracker.originGPS.lat * Math.PI) / 180);
      const y = dLat * (Math.PI / 180) * this.gpsTracker.EARTH_RADIUS;

      return { x, y };
    },

    xyToCanvas(x, y) {
      const originCanvasX = 490; // titik awal X saat tracking mulai
      const originCanvasY = 450; // titik awal Y saat tracking mulai

      const theta = (245 * Math.PI) / 180; // sudut rotasi dalam radian
      const xr = x * Math.cos(theta) - y * Math.sin(theta);
      const yr = x * Math.sin(theta) + y * Math.cos(theta);
      const canvasX = originCanvasX + xr * this.gpsTracker.pixelsPerMeter;
      const canvasY = originCanvasY - yr * this.gpsTracker.pixelsPerMeter;
      // const canvasX = this.gpsTracker.MARGIN + x * this.gpsTracker.pixelsPerMeter;
      // const canvasY = this.gpsTracker.canvas.height - this.gpsTracker.MARGIN - y * this.gpsTracker.pixelsPerMeter;
      return { canvasX, canvasY };
    },

    getGridSpacing() {
      const viewRange = (this.gpsTracker.canvas.width - this.gpsTracker.MARGIN * 2) / this.gpsTracker.pixelsPerMeter;
      if (viewRange > 500) return 100;
      if (viewRange > 200) return 50;
      if (viewRange > 100) return 20;
      if (viewRange > 50) return 10;
      if (viewRange > 20) return 5;
      if (viewRange > 10) return 2;
      return 1;
    },

    drawExamplePattern() {
      const ctx = this.gpsTracker.ctx;
      const canvas = this.gpsTracker.canvas;

      const w = canvas.width;
      const h = canvas.height;

      // Ukuran elemen proporsional
      const dotRadius = w * 0.008;
      const boxWidth = w * 0.08;
      const boxHeight = h * 0.035;
      const boxBlueWidth = w * 0.06;
      const boxBlueHeight = h * 0.025;

      // Posisi vertikal relatif
      const topYGreen = h * 0.24;
      const topYRed = h * 0.3;
      const sideTopY = h * 0.35;
      const sideGap = h * 0.19;
      const bottomY = h * 0.78;

      // Warna dengan opacity
      const green = "#00a753ff";
      const red = "#ff0000ff";
      const blue = "#005fbefa";

      // ===== Titik di bagian atas =====
      const numTopDots = 4;
      const topStartX = w * 0.38;
      const topEndX = w * 0.68;
      const topGapX = (topEndX - topStartX) / (numTopDots - 1);

      for (let i = 0; i < numTopDots; i++) {
        const x = topStartX + i * topGapX;

        // Titik hijau
        ctx.beginPath();
        ctx.arc(x, topYGreen, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();

        // Titik merah di bawahnya
        ctx.beginPath();
        ctx.arc(x, topYRed, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();
      }

      // ===== Titik di sisi kiri =====
      for (let i = 0; i < 2; i++) {
        const y = sideTopY + i * sideGap;
        const x1 = w * 0.1;
        const x2 = w * 0.2;

        // Hijau
        ctx.beginPath();
        ctx.arc(x1, y + sideGap * 0.2, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();

        // Merah
        ctx.beginPath();
        ctx.arc(x2, y + sideGap * 0.2, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();
      }
      for (let i = 0; i < 1; i++) {
        const y = sideTopY + i * sideGap;
        const x1 = w * 0.07;
        const x2 = w * 0.17;

        // Hijau
        ctx.beginPath();
        ctx.arc(x1, y + sideGap * 0.7, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();

        // Merah
        ctx.beginPath();
        ctx.arc(x2, y + sideGap * 0.7, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();
      }

      // ===== Titik di sisi kanan =====
      for (let i = 0; i < 1; i++) {
        const y = sideTopY + i * h * 0.08;
        const x1 = w * 0.72;
        const x2 = w * 0.84;

        // Hijau
        ctx.beginPath();
        ctx.arc(x1, y + sideGap * 0.6, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();

        // Merah
        ctx.beginPath();
        ctx.arc(x2, y + sideGap * 0.6, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();
      }
      for (let i = 0; i < 1; i++) {
        const y = sideTopY + i * sideGap;
        const x1 = w * 0.77;
        const x2 = w * 0.87;

        // Hijau
        ctx.beginPath();
        ctx.arc(x1, y + sideGap * 0.2, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();

        // Merah
        ctx.beginPath();
        ctx.arc(x2, y + sideGap * 0.2, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();
      }
      for (let i = 0; i < 1; i++) {
        const y = sideTopY + i * sideGap;
        const x1 = w * 0.75;
        const x2 = w * 0.85;

        // Hijau
        ctx.beginPath();
        ctx.arc(x1, y + sideGap * 1, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = red;
        ctx.fill();

        // Merah
        ctx.beginPath();
        ctx.arc(x2, y + sideGap * 1, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = green;
        ctx.fill();
      }

      // ===== Kotak hijau dan biru di bawah =====
      ctx.fillStyle = red;
      ctx.fillRect(w * 0.8, h * 0.81, boxWidth, boxHeight);
      ctx.fillStyle = green;
      ctx.fillRect(w * 0.18, bottomY - h * 0.08, boxWidth, boxHeight);

      ctx.fillStyle = blue;
      ctx.fillRect(w * 0.38, bottomY + h * 0.06, boxBlueWidth, boxBlueHeight);
    },

    drawGPSCanvas() {
      if (!this.gpsTracker.ctx) return;
      const ctx = this.gpsTracker.ctx;
      const canvas = this.gpsTracker.canvas;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pattern PERTAMA (background)
      this.drawExamplePattern();

      // Draw axes dan grid
      this.drawAxes();
      this.drawOrigin();

      // Draw trajectory PATH
      if (this.gpsTracker.path.length > 0) {
        this.drawPath();
      }

      // Update scale info
      this.updateScaleInfo();
    },

    drawGrid() {
      const ctx = this.gpsTracker.ctx;
      const canvas = this.gpsTracker.canvas;
      const gridSpacing = this.getGridSpacing();

      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      ctx.font = "9px Arial, sans-serif";
      ctx.fillStyle = "#444";

      const maxXY = (canvas.width - this.gpsTracker.MARGIN * 2) / this.gpsTracker.pixelsPerMeter;

      for (let x = 0; x <= maxXY; x += gridSpacing) {
        const coords = this.xyToCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(coords.canvasX, this.gpsTracker.MARGIN);
        ctx.lineTo(coords.canvasX, canvas.height - this.gpsTracker.MARGIN);
        ctx.stroke();
        ctx.fillText(`${x}`, coords.canvasX - 8, canvas.height - this.gpsTracker.MARGIN + 12);
      }

      for (let y = 0; y <= maxXY; y += gridSpacing) {
        const coords = this.xyToCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(this.gpsTracker.MARGIN, coords.canvasY);
        ctx.lineTo(canvas.width - this.gpsTracker.MARGIN, coords.canvasY);
        ctx.stroke();
        ctx.fillText(`${y}`, 5, coords.canvasY + 3);
      }
    },

    drawAxes() {
      const ctx = this.gpsTracker.ctx;
      const canvas = this.gpsTracker.canvas;
      ctx.strokeStyle = "#0084ffff";
      ctx.lineWidth = 2;
    },

    drawOrigin() {
      const ctx = this.gpsTracker.ctx;
      const origin = this.xyToCanvas(0, 0);
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(origin.canvasX, origin.canvasY, 4, 0, 2 * Math.PI);
      ctx.fill();
      // const size = this.gpsTracker.shipImageSize;
      // ctx.save();
      // ctx.translate(origin.canvasX, origin.canvasY);
      // // kalau mau bisa ditambah rotate di sini:
      // // ctx.rotate(angleRad);
      // ctx.drawImage(this.gpsTracker.shipImage, -size / 2, -size / 2, size, size);
      // ctx.restore();
    },

    drawPath() {
      const ctx = this.gpsTracker.ctx;
      const path = this.gpsTracker.path.map((p) => ({ ...p, ...this.xyToCanvas(p.x, p.y) }));

      // Draw trajectory line
      ctx.beginPath();
      path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.canvasX, p.canvasY);
        else ctx.lineTo(p.canvasX, p.canvasY);
      });
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Draw path points
      path.forEach((p, i) => {
        const isLast = i === path.length - 1;
        ctx.beginPath();
        ctx.arc(p.canvasX, p.canvasY, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "#00e1ffff";
        ctx.fill();

        if (isLast) {
          // compute heading angle from previous point if available
          let angle = 0;
          if (path.length > 1) {
            const prev = path[path.length - 2];
            angle = Math.atan2(p.canvasY - prev.canvasY, p.canvasX - prev.canvasX);
          }

          // draw ship
          this.drawShip(ctx, p.canvasX, p.canvasY, angle, 8);
          //ctx.drawImage(this.gpsTracker.shipImage, -size / 2, -size / 2, size, size);

          // stroke outline and label coordinates
          ctx.strokeStyle = "#000000ff";
          ctx.lineWidth = 1.5;
          ctx.fillStyle = "#ff0000";
          ctx.font = "bold 10px Arial, sans-serif";
          ctx.fillText(`(${p.x.toFixed(1)},${p.y.toFixed(1)})`, p.canvasX + 12, p.canvasY - 10);
        }
      });
    },
    drawShip(ctx, x, y, angle = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      const size = this.gpsTracker.shipImageSize;

      // kalau mau bisa ditambah rotate di sini:
      // ctx.rotate(angleRad);
      ctx.drawImage(this.gpsTracker.shipImage, -size / 2, -size / 2, size, size);
      ctx.restore();
    },

    updateGPSFromVehicle() {
      const lat = this.vehicleData.lat;
      const lon = this.vehicleData.lon;

      // Skip jika data GPS tidak valid atau tracking tidak aktif
      if (!this.gpsTracker.isTracking) return;
      if (!lat || !lon || lat === 0 || lon === 0) return;

      this.updateGPSPosition();
    },

    updateGPSPosition() {
      const lat = this.vehicleData.lat;
      const lon = this.vehicleData.lon;
      if (!lat || !lon || lat === 0 || lon === 0) return;

      const timestamp = Date.now();

      if (!this.gpsTracker.originGPS) {
        this.gpsTracker.originGPS = { lat, lon };
        this.gpsTracker.startTime = timestamp;
        toastr.success("Origin GPS ditetapkan dari vehicleData!");
      }

      if (this.gpsTracker.path.length > 0) {
        const last = this.gpsTracker.path[this.gpsTracker.path.length - 1];
        const dist = this.calculateDistance(last.lat, last.lon, lat, lon);
        if (dist < 0.5) return; // abaikan pergerakan kecil
        this.gpsTracker.totalDistance += dist;
      }

      const xy = this.gpsToLocalXY(lat, lon);
      this.gpsTracker.path.push({
        x: xy.x,
        y: xy.y,
        lat,
        lon,
        timestamp,
        accuracy: 1.0,
        speed: 0,
      });
      this.drawGPSCanvas();
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return this.gpsTracker.EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    updateScaleInfo() {
      const viewRange = (this.gpsTracker.canvas.width - this.gpsTracker.MARGIN * 2) / this.gpsTracker.pixelsPerMeter;
      const scaleText = `${this.getGridSpacing()} m/div`;
      const rangeText = `${viewRange.toFixed(0)} m x ${viewRange.toFixed(0)} m`;
      const ctx = this.gpsTracker.ctx;
      ctx.fillStyle = "#000000ff";
      ctx.font = "10px Arial, sans-serif";
      ctx.fillText(scaleText, 10, this.gpsTracker.canvas.height - 25);
      ctx.fillText(rangeText, 10, this.gpsTracker.canvas.height - 10);
    },

    startGPSTracking() {
      // Check already tracking
      if (this.gpsTracker.isTracking) {
        console.log("GPS already tracking");
        toastr.info("GPS Tracking already active");
        return;
      }

      // Get current GPS data
      const lat = this.vehicleData.lat;
      const lon = this.vehicleData.long;

      // Debug log
      console.log("START clicked - GPS Data:", { lat, lon });

      // Validasi data GPS tersedia dan valid
      if (!lat || !lon || lat === 0 || lon === 0) {
        console.warn("GPS data not ready:", { lat, lon });
        toastr.warning("Waiting for valid GPS data from vehicle...", "Please Wait", {
          timeOut: 3000,
        });

        // Retry maksimal 10x (20 detik total)
        if (!this.gpsTracker.retryCount) {
          this.gpsTracker.retryCount = 0;
        }

        this.gpsTracker.retryCount++;

        if (this.gpsTracker.retryCount < 10) {
          console.log(`Retry ${this.gpsTracker.retryCount}/10 in 2 seconds...`);
          setTimeout(() => this.startGPSTracking(), 2000);
        } else {
          console.error("Max retry reached. GPS data still not available.");
          toastr.error("Cannot start tracking. GPS data not available.", "Error");
          this.gpsTracker.retryCount = 0;
        }
        return;
      }

      // Reset retry counter
      this.gpsTracker.retryCount = 0;

      // Set origin GPS dari posisi saat ini
      this.gpsTracker.originGPS = {
        lat: lat,
        lon: lon,
      };
      this.gpsTracker.startTime = Date.now();

      // Mulai tracking
      this.gpsTracker.isTracking = true;
      // Tambahkan titik awal path agar kapal muncul di posisi awal canvas (157, 29)
      this.gpsTracker.path.push({
        x: 0,
        y: 0,
        lat,
        lon,
        timestamp: Date.now(),
      });

      this.drawGPSCanvas();

      console.log("✓ GPS Tracking started - Origin set:", this.gpsTracker.originGPS);
      toastr.success(`Origin GPS set!\nLat: ${lat.toFixed(6)}\nLon: ${lon.toFixed(6)}`, "GPS Started!", { timeOut: 5000 });

      // Optional: Browser GPS sebagai fallback
      if (navigator.geolocation) {
        this.gpsTracker.watchId = navigator.geolocation.watchPosition(
          (pos) => {
            // Gunakan hanya jika vehicleData.lat masih 0
            if (!this.vehicleData.lat || this.vehicleData.lat === 0) {
              console.log("Using browser GPS as fallback");
              this.vehicleData.lat = pos.coords.latitude;
              this.vehicleData.long = pos.coords.longitude;
            }
          },
          (err) => console.warn("Browser GPS error:", err.message),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    },

    stopGPSTracking() {
      if (this.gpsTracker.watchId) navigator.geolocation.clearWatch(this.gpsTracker.watchId);
      this.gpsTracker.isTracking = false;
      toastr.info("Tracking stopped");
    },

    clearGPSPath() {
      if (!confirm("Clear GPS data?")) return;
      if (this.gpsTracker.isTracking) this.stopGPSTracking();
      Object.assign(this.gpsTracker, {
        path: [],
        originGPS: null,
        totalDistance: 0,
        startTime: null,
        retryCount: 0,
      });
      this.drawGPSCanvas();
      toastr.success("GPS data cleared");
      this.startGPSTracking();
    },

    async requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          this.gpsTracker.wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        console.log("Wake lock unsupported");
      }
    },
  };
};
