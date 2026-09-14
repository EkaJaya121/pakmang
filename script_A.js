const x_data = () => {
    return {
        currentScreen: "menu",
        currentMode: "monitoring",

        // =========================================================
        // LOGIN
        // =========================================================
        loginUsername: "",
        loginPassword: "",
        correctUsername: "krakatau",
        correctPassword: "andover",

        // =========================================================
        // API
        // =========================================================
        ipAddress: "https://api.krakatauandover.my.id",
        // ipAddress: "http://192.168.0.112:5001",

        realtimeData: true,

        // =========================================================
        // POLLING
        // =========================================================
        pollIntervals: {
            context: 1000,
            cameraRefresh: 1000,
        },

        contextFetchInProgress: false,

        currentDate: moment().format("YYYY-MM-DD"),
        currentTime: moment().format("HH:mm:ss"),

        // =========================================================
        // SURFACE CAMERA
        // =========================================================
        surfaceCamera: {
            streamUrl: "",
            waypointsText: "",
            waypoints: [],
            image: "",
            refreshImage: 0,
            refreshStream: 0,
        },

        // =========================================================
        // UNDERWATER CAMERA
        // =========================================================
        underwaterCamera: {
            streamUrl: "",
            waypointsText: "",
            waypoints: [],
            image: "",
            refreshImage: 0,
            refreshStream: 0,
        },

        // =========================================================
        // VEHICLE DATA
        // =========================================================
        vehicleData: {
            altitude: 0,
            lat: 0,
            lon: 0,

            // Alias lama
            alt: 0,
            long: 0,

            // GPS course
            course: null,
            cog: null,

            // COMPASS HEADING
            heading: null,
            yaw: 0,

            // SPEED
            speed_mps: 0,
            speed_kmh: 0,
            speed_knots: 0,

            // Alias lama
            sog: 0,

            // CONNECTION
            gcs_active: false,
            app_connect: false,

            // GPS STATUS
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

            // MOTOR
            left_rpm: 0,
            right_rpm: 0,
            motor_data_age: 0,
            motor_direction: "",
            motor_speed_mps: 0,
            motor_updated_at: 0,

            session_id: "",
            timestamp: "",

            // FIELD LAMA
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

        // =========================================================
        // GPS TRACKER
        // =========================================================
        gpsTracker: {

            canvas: null,
            ctx: null,

            ctxPattern: null,
            canvasPattern: null,

            watchId: null,

            // GPS origin
            originGPS: null,

            // GPS trajectory
            path: [],

            totalDistance: 0,

            startTime: null,
            lastUpdateTime: null,

            // =====================================================
            // SCALE
            // =====================================================
            pixelsPerMeter: 17,

            CANVAS_SIZE: 600,
            MARGIN: 40,

            EARTH_RADIUS: 6371000,

            isTracking: false,

            wakeLock: null,

            retryCount: 0,

            // =====================================================
            // SHIP IMAGE
            // =====================================================
            shipImage: null,
            shipImageLoaded: false,
            shipImageSize: 68,

            // =====================================================
            // KOMPAS
            // =====================================================
            lastHeading: null,

            /*
             * Heading offset gambar kapal.
             *
             * Jika bagian depan kapal.png menghadap KE ATAS:
             *
             * 0 = benar
             *
             * Jika nanti ternyata:
             * kanan  -> -90
             * bawah  -> 180
             * kiri   -> 90
             */
            SHIP_HEADING_OFFSET: 0,
        },

        // =========================================================
        // INIT
        // =========================================================
        async init() {

            // Init GPS Canvas
            this.initGPSCanvas();

            // Mulai GPS tracking
            this.startGPSTracking();

            // Kamera surface
            try {
                await this.startSurfaceCamera();
            } catch (e) {
                console.warn(
                    "Failed to start surface camera:",
                    e.message
                );
            }

            // Kamera underwater
            try {
                await this.startUnderwaterCamera();
            } catch (e) {
                console.warn(
                    "Failed to start underwater camera:",
                    e.message
                );
            }

            // Fetch telemetry pertama
            this.fetchContext();

            // Polling telemetry
            setInterval(() => {
                this.fetchContext();
            }, this.pollIntervals.context);

            // Refresh image
            this.refreshLatestImages();

            setInterval(() => {
                this.refreshLatestImages();
            }, this.pollIntervals.cameraRefresh);

            // Update waktu
            setInterval(() => {
                this.currentDate =
                    moment().format("YYYY-MM-DD");

                this.currentTime =
                    moment().format("HH:mm:ss");

            }, 1000);

            // Toastr
            toastr.options = {
                closeButton: true,
                progressBar: true,
                positionClass: "toast-top-right",
                timeOut: "5000",
            };

            // Wake lock
            this.requestWakeLock();
        },

        // =========================================================
        // MENU
        // =========================================================
        async selectMonitoring() {

            this.currentMode = "monitoring";
            this.currentScreen = "dashboard";

            toastr.info(
                "Monitoring mode activated"
            );
        },

        async showLogin() {

            this.currentScreen = "login";

            this.loginUsername = "";
            this.loginPassword = "";
        },

        async login() {

            if (
                this.loginUsername ===
                this.correctUsername &&
                this.loginPassword ===
                this.correctPassword
            ) {

                this.currentMode = "control";
                this.currentScreen = "dashboard";

                toastr.success(
                    "Login successful! Control mode activated"
                );

            } else {

                toastr.error(
                    "Invalid username or password!"
                );
            }
        },

        async logout() {

            this.currentScreen = "menu";

            this.currentMode = "monitoring";

            this.loginUsername = "";
            this.loginPassword = "";

            toastr.info(
                "Logged out successfully"
            );
        },

        async backToMenu() {

            this.currentScreen = "menu";
        },

        // =========================================================
        // GCS CONNECT
        // =========================================================
        async connectGcs() {

            try {

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        app_connect: true,
                    }
                );

                toastr.success(
                    "GCS connected successfully!",
                    "Success"
                );

                return true;

            } catch (error) {

                toastr.error(
                    "Failed to connect GCS",
                    "Error"
                );

                return false;
            }
        },

        async disconnectGcs() {

            try {

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        app_connect: false,
                    }
                );

                toastr.success(
                    "GCS disconnected successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to disconnect GCS",
                    "Error"
                );
            }
        },

        // =========================================================
        // FETCH TELEMETRY
        // =========================================================
        async fetchContext() {

            if (
                !this.realtimeData ||
                this.contextFetchInProgress
            ) {
                return;
            }

            this.contextFetchInProgress = true;

            const controller =
                new AbortController();

            const timeoutId =
                setTimeout(() => {
                    controller.abort();
                }, 4500);

            try {

                const response = await fetch(
                    `${this.ipAddress}/telemetry`,
                    {
                        method: "GET",
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                const payload =
                    await response.json();

                // =================================================
                // SIMPAN current WP SEBELUM REPLACE DATA
                // =================================================
                const oldCurrentWP =
                    this.vehicleData.current_wp ?? 0;

                // =================================================
                // NORMALISASI TELEMETRY
                // =================================================
                this.vehicleData = {

                    ...payload,

                    // GPS
                    lat: Number(payload.lat ?? 0),
                    lon: Number(payload.lon ?? 0),

                    // Alias
                    long: Number(payload.lon ?? 0),

                    // ALTITUDE
                    altitude:
                        Number(payload.altitude ?? 0),

                    alt:
                        Number(payload.altitude ?? 0),

                    // =================================================
                    // HEADING KOMPAS
                    // =================================================
                    heading:
                        this.normalizeHeading(
                            payload.heading
                        ),

                    yaw:
                        this.normalizeHeading(
                            payload.heading
                        ),

                    // =================================================
                    // COURSE GPS
                    // =================================================
                    course:
                        payload.course !== null &&
                            payload.course !== undefined
                            ? Number(payload.course)
                            : null,

                    cog:
                        payload.course !== null &&
                            payload.course !== undefined
                            ? Number(payload.course)
                            : 0,

                    // SPEED
                    speed_mps:
                        Number(payload.speed_mps ?? 0),

                    speed_kmh:
                        Number(payload.speed_kmh ?? 0),

                    speed_knots:
                        Number(payload.speed_knots ?? 0),

                    sog:
                        Number(payload.speed_knots ?? 0),

                    // CONNECTION
                    gcs_active:
                        payload.gcs_active ?? false,

                    app_connect: true,

                    // GPS STATUS
                    fix:
                        payload.fix ?? false,

                    gps_valid:
                        payload.gps_valid ?? false,

                    // WP
                    current_wp:
                        payload.current_wp ??
                        oldCurrentWP,

                    // CAMERA
                    surface_camera_connect:
                        this.surfaceCamera.streamUrl !== "",

                    underwater_camera_connect:
                        this.underwaterCamera.streamUrl !== "",
                };

                // =================================================
                // SIMPAN HEADING TERBARU
                // =================================================
                if (
                    this.vehicleData.heading !== null &&
                    Number.isFinite(
                        this.vehicleData.heading
                    )
                ) {

                    this.gpsTracker.lastHeading =
                        this.vehicleData.heading;

                    console.log(
                        "🧭 Compass Heading:",
                        this.vehicleData.heading
                    );
                }

                // =================================================
                // UPDATE GPS
                // =================================================
                this.updateGPSFromVehicle();

                // =================================================
                // REDRAW CANVAS
                // =================================================
                if (
                    this.gpsTracker.isTracking
                ) {
                    this.drawGPSCanvas();
                }

                // =================================================
                // AUTO WAYPOINT CAPTURE
                // =================================================
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

                this.vehicleData.app_connect =
                    false;

                this.vehicleData.gcs_active =
                    false;

            } finally {

                clearTimeout(timeoutId);

                this.contextFetchInProgress =
                    false;
            }
        },

        // =========================================================
        // NORMALIZE HEADING
        // =========================================================
        normalizeHeading(value) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return null;
            }

            const number =
                Number(value);

            if (!Number.isFinite(number)) {
                return null;
            }

            // Normalisasi menjadi 0 - 360
            return (
                (number % 360) + 360
            ) % 360;
        },

        // =========================================================
        // CAMERA CONNECTION
        // =========================================================
        updateCameraConnectionState() {

            this.surfaceCamera.streamUrl =
                this.vehicleData.surface_camera_connect
                    ? `${this.ipAddress}/surface_feed?ts=${Date.now()}`
                    : "";

            this.underwaterCamera.streamUrl =
                this.vehicleData.underwater_camera_connect
                    ? `${this.ipAddress}/underwater_feed?ts=${Date.now()}`
                    : "";
        },

        // =========================================================
        // REFRESH IMAGE
        // =========================================================
        refreshLatestImages() {

            const timestamp =
                Date.now();

            this.surfaceCamera.image =
                `${this.ipAddress}/api/latest-photo/surface?ts=${timestamp}`;

            this.underwaterCamera.image =
                `${this.ipAddress}/api/latest-photo/underwater?ts=${timestamp}`;
        },

        // =========================================================
        // SURFACE WAYPOINT
        // =========================================================
        async saveSurfaceWaypoints() {

            if (
                this.surfaceCamera.waypointsText === ""
            ) {

                toastr.error(
                    "Waypoints for surface camera cannot be empty",
                    "Error"
                );

                return;
            }

            try {

                this.surfaceCamera.waypoints =
                    this.surfaceCamera.waypointsText
                        .split(" ");

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        surface_camera_waypoints:
                            this.surfaceCamera.waypoints,
                    }
                );

                toastr.success(
                    "Waypoints for surface camera saved successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to save waypoints for surface camera",
                    "Error"
                );
            }
        },

        // =========================================================
        // START SURFACE CAMERA
        // =========================================================
        async startSurfaceCamera() {

            try {

                this.surfaceCamera.streamUrl =
                    `${this.ipAddress}/surface_feed?ts=${Date.now()}`;

                console.log(
                    "Surface stream:",
                    this.surfaceCamera.streamUrl
                );

                return true;

            } catch (error) {

                console.error(
                    "Failed to start surface camera:",
                    error
                );

                toastr.error(
                    "Failed to start surface camera",
                    "Error"
                );

                return false;
            }
        },

        // =========================================================
        // STOP SURFACE CAMERA
        // =========================================================
        async stopSurfaceCamera() {

            try {

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        surface_camera_connect: false,
                    }
                );

                this.surfaceCamera.streamUrl =
                    "";

                toastr.success(
                    "Surface camera stopped successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to stop surface camera",
                    "Error"
                );
            }
        },

        // =========================================================
        // CAPTURE SURFACE
        // =========================================================
        async captureSurfaceImage() {

            try {

                await axios.get(
                    `${this.ipAddress}/camera/surface-capture`
                );

                this.surfaceCamera.refreshImage += 1;

                this.surfaceCamera.image =
                    `${this.ipAddress}/api/latest-photo/surface?refresh=${this.surfaceCamera.refreshImage}`;

                toastr.success(
                    "Image for surface camera captured successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to capture surface image",
                    "Error"
                );
            }
        },

        // =========================================================
        // START UNDERWATER
        // =========================================================
        async startUnderwaterCamera() {

            try {

                this.underwaterCamera.streamUrl =
                    `${this.ipAddress}/underwater_feed?ts=${Date.now()}`;

                console.log(
                    "Underwater stream:",
                    this.underwaterCamera.streamUrl
                );

                return true;

            } catch (error) {

                console.error(
                    "Failed to start underwater camera:",
                    error
                );

                toastr.error(
                    "Failed to start underwater camera",
                    "Error"
                );

                return false;
            }
        },

        // =========================================================
        // STOP UNDERWATER
        // =========================================================
        async stopUnderwaterCamera() {

            try {

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        underwater_camera_connect: false,
                    }
                );

                this.underwaterCamera.streamUrl =
                    "";

                toastr.success(
                    "Underwater camera stopped successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to stop underwater camera",
                    "Error"
                );
            }
        },

        // =========================================================
        // UNDERWATER WAYPOINT
        // =========================================================
        async saveUnderwaterWaypoints() {

            if (
                this.underwaterCamera.waypointsText === ""
            ) {

                toastr.error(
                    "Waypoints for underwater camera cannot be empty",
                    "Error"
                );

                return;
            }

            try {

                this.underwaterCamera.waypoints =
                    this.underwaterCamera.waypointsText
                        .split(" ");

                await axios.post(
                    `${this.ipAddress}/telemetry`,
                    {
                        underwater_camera_waypoints:
                            this.underwaterCamera.waypoints,
                    }
                );

                toastr.success(
                    "Waypoints for underwater camera saved successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to save waypoints for underwater camera",
                    "Error"
                );
            }
        },

        // =========================================================
        // CAPTURE UNDERWATER
        // =========================================================
        async captureUnderwaterImage() {

            try {

                await axios.get(
                    `${this.ipAddress}/camera/underwater-capture`
                );

                this.underwaterCamera.refreshImage += 1;

                this.underwaterCamera.image =
                    `${this.ipAddress}/camera/underwater-latest?refresh=${this.underwaterCamera.refreshImage}`;

                toastr.success(
                    "Image for underwater camera captured successfully!",
                    "Success"
                );

            } catch (error) {

                toastr.error(
                    "Failed to capture underwater image",
                    "Error"
                );
            }
        },

        // =========================================================
        // AUTO SURFACE CAPTURE
        // =========================================================
        async waypointCaptureSurfaceAuto() {

            try {

                const currentWP =
                    this.vehicleData.current_wp;

                const waypoints =
                    this.surfaceCamera.waypoints;

                if (
                    !waypoints ||
                    waypoints.length === 0
                ) {
                    return;
                }

                if (
                    waypoints.includes(
                        String(currentWP)
                    )
                ) {

                    console.log(
                        `📸 Waypoint ${currentWP} matched – taking surface photo`
                    );

                    await this.captureSurfaceImage();

                    this.surfaceCamera.waypoints =
                        this.surfaceCamera.waypoints.filter(
                            (wp) =>
                                wp !== String(currentWP)
                        );

                    this.surfaceCamera.waypointsText =
                        this.surfaceCamera.waypoints.join(
                            " "
                        );

                    toastr.success(
                        `Auto-captured image for surface waypoint ${currentWP}!`
                    );
                }

            } catch (error) {

                console.error(error);

                toastr.error(
                    "Failed to auto-capture surface image",
                    "Error"
                );
            }
        },

        // =========================================================
        // AUTO UNDERWATER CAPTURE
        // =========================================================
        async waypointCaptureUnderwaterAuto() {

            try {

                const currentWP =
                    this.vehicleData.current_wp;

                const waypoints =
                    this.underwaterCamera.waypoints;

                if (
                    !waypoints ||
                    waypoints.length === 0
                ) {
                    return;
                }

                if (
                    waypoints.includes(
                        String(currentWP)
                    )
                ) {

                    console.log(
                        `📸 Waypoint ${currentWP} matched – taking underwater photo`
                    );

                    await this.captureUnderwaterImage();

                    this.underwaterCamera.waypoints =
                        this.underwaterCamera.waypoints.filter(
                            (wp) =>
                                wp !== String(currentWP)
                        );

                    this.underwaterCamera.waypointsText =
                        this.underwaterCamera.waypoints.join(
                            " "
                        );

                    toastr.success(
                        `Auto-captured image for underwater waypoint ${currentWP}!`
                    );
                }

            } catch (error) {

                console.error(error);

                toastr.error(
                    "Failed to auto-capture underwater image",
                    "Error"
                );
            }
        },

        // =========================================================
        // SAVE SURFACE IMAGE
        // =========================================================
        async saveSurfaceImage() {

            try {

                const imageUrl =
                    this.surfaceCamera.image;

                if (
                    !imageUrl ||
                    imageUrl === ""
                ) {

                    toastr.warning(
                        "No surface image to save",
                        "Warning"
                    );

                    return;
                }

                const response =
                    await fetch(imageUrl);

                if (!response.ok) {
                    throw new Error(
                        "Failed to fetch image"
                    );
                }

                const blob =
                    await response.blob();

                const url =
                    window.URL.createObjectURL(
                        blob
                    );

                const a =
                    document.createElement("a");

                a.href = url;

                const timestamp =
                    moment().format(
                        "YYYY-MM-DD_HH-mm-ss"
                    );

                a.download =
                    `surface_image_${timestamp}.jpg`;

                document.body.appendChild(a);

                a.click();

                document.body.removeChild(a);

                window.URL.revokeObjectURL(url);

                toastr.success(
                    "Surface image saved successfully!",
                    "Success"
                );

            } catch (error) {

                console.error(
                    "Save surface image error:",
                    error
                );

                toastr.error(
                    "Failed to save surface image",
                    "Error"
                );
            }
        },

        // =========================================================
        // DELETE SURFACE
        // =========================================================
        async deleteSurfaceImage() {

            try {

                if (
                    !confirm(
                        "Are you sure you want to delete the surface image?"
                    )
                ) {
                    return;
                }

                try {

                    await axios.delete(
                        `${this.ipAddress}/camera/surface-latest`
                    );

                } catch (apiError) {

                    console.warn(
                        "Server delete failed, deleting locally only:",
                        apiError.message
                    );
                }

                this.surfaceCamera.image =
                    "";

                this.surfaceCamera.refreshImage =
                    0;

                toastr.success(
                    "Surface image deleted successfully!",
                    "Success"
                );

            } catch (error) {

                console.error(
                    "Delete surface image error:",
                    error
                );

                toastr.error(
                    "Failed to delete surface image",
                    "Error"
                );
            }
        },

        // =========================================================
        // SAVE UNDERWATER
        // =========================================================
        async saveUnderwaterImage() {

            try {

                const imageUrl =
                    this.underwaterCamera.image;

                if (
                    !imageUrl ||
                    imageUrl === ""
                ) {

                    toastr.warning(
                        "No underwater image to save",
                        "Warning"
                    );

                    return;
                }

                const response =
                    await fetch(imageUrl);

                if (!response.ok) {
                    throw new Error(
                        "Failed to fetch image"
                    );
                }

                const blob =
                    await response.blob();

                const url =
                    window.URL.createObjectURL(
                        blob
                    );

                const a =
                    document.createElement("a");

                a.href = url;

                const timestamp =
                    moment().format(
                        "YYYY-MM-DD_HH-mm-ss"
                    );

                a.download =
                    `underwater_image_${timestamp}.jpg`;

                document.body.appendChild(a);

                a.click();

                document.body.removeChild(a);

                window.URL.revokeObjectURL(url);

                toastr.success(
                    "Underwater image saved successfully!",
                    "Success"
                );

            } catch (error) {

                console.error(
                    "Save underwater image error:",
                    error
                );

                toastr.error(
                    "Failed to save underwater image",
                    "Error"
                );
            }
        },

        // =========================================================
        // DELETE UNDERWATER
        // =========================================================
        async deleteUnderwaterImage() {

            try {

                if (
                    !confirm(
                        "Are you sure you want to delete the underwater image?"
                    )
                ) {
                    return;
                }

                try {

                    await axios.delete(
                        `${this.ipAddress}/camera/underwater-latest`
                    );

                } catch (apiError) {

                    console.warn(
                        "Server delete failed, deleting locally only:",
                        apiError.message
                    );
                }

                this.underwaterCamera.image =
                    "";

                this.underwaterCamera.refreshImage =
                    0;

                toastr.success(
                    "Underwater image deleted successfully!",
                    "Success"
                );

            } catch (error) {

                console.error(
                    "Delete underwater image error:",
                    error
                );

                toastr.error(
                    "Failed to delete underwater image",
                    "Error"
                );
            }
        },

        // =========================================================
        // GPS CANVAS INITIALIZATION
        // =========================================================
        initGPSCanvas() {

            const canvas =
                document.getElementById(
                    "gpsCanvas"
                );

            if (!canvas) {

                console.log(
                    "Canvas not found, retrying..."
                );

                setTimeout(() => {
                    this.initGPSCanvas();
                }, 500);

                return;
            }

            this.gpsTracker.canvas =
                canvas;

            this.gpsTracker.ctx =
                canvas.getContext("2d");

            // =====================================================
            // CANVAS SIZE
            // =====================================================
            const size = 600;

            canvas.width = size;
            canvas.height = size;

            canvas.style.width = "100%";
            canvas.style.height = "auto";

            // =====================================================
            // LOAD SHIP IMAGE
            // =====================================================
            this.gpsTracker.shipImage =
                new Image();

            this.gpsTracker.shipImage.onload =
                () => {

                    this.gpsTracker.shipImageLoaded =
                        true;

                    console.log(
                        "🚤 Ship image loaded"
                    );

                    this.drawGPSCanvas();
                };

            this.gpsTracker.shipImage.onerror =
                () => {

                    console.error(
                        "❌ Gagal load img/kapal.png"
                    );

                    this.gpsTracker.shipImageLoaded =
                        false;
                };

            this.gpsTracker.shipImage.src =
                "img/kapal.png";

            // Initial draw
            this.drawGPSCanvas();

            console.log(
                "GPS Tracker initialized - Canvas size:",
                size
            );

            // =====================================================
            // WINDOW RESIZE
            // =====================================================
            window.addEventListener(
                "resize",
                () => {

                    const newSize = 600;

                    const canvas =
                        this.gpsTracker.canvas;

                    if (
                        Math.abs(
                            canvas.width -
                            newSize
                        ) > 50
                    ) {

                        canvas.width =
                            newSize;

                        canvas.height =
                            newSize;

                        this.drawGPSCanvas();
                    }
                }
            );
        },

        // =========================================================
        // GPS LAT/LON -> LOCAL XY
        // =========================================================
        gpsToLocalXY(lat, lon) {

            if (
                !this.gpsTracker.originGPS
            ) {
                return {
                    x: 0,
                    y: 0,
                };
            }

            const dLat =
                lat -
                this.gpsTracker.originGPS.lat;

            const dLon =
                lon -
                this.gpsTracker.originGPS.lon;

            const originLatRad =
                this.gpsTracker.originGPS.lat *
                Math.PI /
                180;

            // Timur-Barat
            const x =
                dLon *
                (Math.PI / 180) *
                this.gpsTracker.EARTH_RADIUS *
                Math.cos(originLatRad);

            // Utara-Selatan
            const y =
                dLat *
                (Math.PI / 180) *
                this.gpsTracker.EARTH_RADIUS;

            return {
                x,
                y,
            };
        },

        // =========================================================
        // LOCAL XY -> CANVAS
        // =========================================================
        xyToCanvas(x, y) {

            const originCanvasX = 490;
            const originCanvasY = 450;

            // x = Timur
            // y = Utara
            //
            // Canvas:
            // kanan = +
            // atas  = -

            const canvasX =
                originCanvasX +
                x *
                this.gpsTracker.pixelsPerMeter;

            const canvasY =
                originCanvasY -
                y *
                this.gpsTracker.pixelsPerMeter;

            return {
                canvasX,
                canvasY,
            };
        },

        // =========================================================
        // GRID SPACING
        // =========================================================
        getGridSpacing() {

            const viewRange =
                (
                    this.gpsTracker.canvas.width -
                    this.gpsTracker.MARGIN * 2
                ) /
                this.gpsTracker.pixelsPerMeter;

            if (viewRange > 500) return 100;
            if (viewRange > 200) return 50;
            if (viewRange > 100) return 20;
            if (viewRange > 50) return 10;
            if (viewRange > 20) return 5;
            if (viewRange > 10) return 2;

            return 1;
        },

        // =========================================================
        // BACKGROUND PATTERN
        // =========================================================
        drawExamplePattern() {

            const ctx =
                this.gpsTracker.ctx;

            const canvas =
                this.gpsTracker.canvas;

            const w =
                canvas.width;

            const h =
                canvas.height;

            const dotRadius =
                w * 0.008;

            const boxWidth =
                w * 0.08;

            const boxHeight =
                h * 0.035;

            const boxBlueWidth =
                w * 0.06;

            const boxBlueHeight =
                h * 0.025;

            const topYGreen =
                h * 0.24;

            const topYRed =
                h * 0.3;

            const sideTopY =
                h * 0.35;

            const sideGap =
                h * 0.19;

            const bottomY =
                h * 0.78;

            const green =
                "#00a753ff";

            const red =
                "#ff0000ff";

            const blue =
                "#005fbefa";

            // =====================================================
            // TOP DOTS
            // =====================================================
            const numTopDots = 4;

            const topStartX =
                w * 0.38;

            const topEndX =
                w * 0.68;

            const topGapX =
                (
                    topEndX -
                    topStartX
                ) /
                (numTopDots - 1);

            for (
                let i = 0;
                i < numTopDots;
                i++
            ) {

                const x =
                    topStartX +
                    i * topGapX;

                ctx.beginPath();

                ctx.arc(
                    x,
                    topYGreen,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x,
                    topYRed,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();
            }

            // =====================================================
            // LEFT
            // =====================================================
            for (
                let i = 0;
                i < 2;
                i++
            ) {

                const y =
                    sideTopY +
                    i * sideGap;

                const x1 =
                    w * 0.1;

                const x2 =
                    w * 0.2;

                ctx.beginPath();

                ctx.arc(
                    x1,
                    y + sideGap * 0.2,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x2,
                    y + sideGap * 0.2,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();
            }

            for (
                let i = 0;
                i < 1;
                i++
            ) {

                const y =
                    sideTopY +
                    i * sideGap;

                const x1 =
                    w * 0.07;

                const x2 =
                    w * 0.17;

                ctx.beginPath();

                ctx.arc(
                    x1,
                    y + sideGap * 0.7,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x2,
                    y + sideGap * 0.7,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();
            }

            // =====================================================
            // RIGHT
            // =====================================================
            for (
                let i = 0;
                i < 1;
                i++
            ) {

                const y =
                    sideTopY +
                    i * h * 0.08;

                const x1 =
                    w * 0.72;

                const x2 =
                    w * 0.84;

                ctx.beginPath();

                ctx.arc(
                    x1,
                    y + sideGap * 0.6,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x2,
                    y + sideGap * 0.6,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();
            }

            for (
                let i = 0;
                i < 1;
                i++
            ) {

                const y =
                    sideTopY +
                    i * sideGap;

                const x1 =
                    w * 0.77;

                const x2 =
                    w * 0.87;

                ctx.beginPath();

                ctx.arc(
                    x1,
                    y + sideGap * 0.2,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x2,
                    y + sideGap * 0.2,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();
            }

            for (
                let i = 0;
                i < 1;
                i++
            ) {

                const y =
                    sideTopY +
                    i * sideGap;

                const x1 =
                    w * 0.75;

                const x2 =
                    w * 0.85;

                ctx.beginPath();

                ctx.arc(
                    x1,
                    y + sideGap * 1,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    red;

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    x2,
                    y + sideGap * 1,
                    dotRadius,
                    0,
                    2 * Math.PI
                );

                ctx.fillStyle =
                    green;

                ctx.fill();
            }

            // =====================================================
            // BOTTOM BOX
            // =====================================================
            ctx.fillStyle =
                red;

            ctx.fillRect(
                w * 0.8,
                h * 0.81,
                boxWidth,
                boxHeight
            );

            ctx.fillStyle =
                green;

            ctx.fillRect(
                w * 0.18,
                bottomY - h * 0.08,
                boxWidth,
                boxHeight
            );

            ctx.fillStyle =
                blue;

            ctx.fillRect(
                w * 0.38,
                bottomY + h * 0.06,
                boxBlueWidth,
                boxBlueHeight
            );
        },

        // =========================================================
        // DRAW GPS CANVAS
        // =========================================================
        drawGPSCanvas() {

            if (
                !this.gpsTracker.ctx
            ) {
                return;
            }

            const ctx =
                this.gpsTracker.ctx;

            const canvas =
                this.gpsTracker.canvas;

            // Clear
            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Background
            this.drawExamplePattern();

            // Grid / axes
            this.drawAxes();

            // Grid sebenarnya jika diperlukan:
            // this.drawGrid();

            // Trajectory
            if (
                this.gpsTracker.path.length >
                0
            ) {
                this.drawPath();

                // =================================================
                // KAPAL DIGAMBAR TERAKHIR
                // supaya berada di atas trajectory
                // =================================================
                this.drawShipAtCurrentPosition();
            }

            // Scale
            this.updateScaleInfo();
        },

        // =========================================================
        // DRAW GRID
        // =========================================================
        drawGrid() {

            const ctx =
                this.gpsTracker.ctx;

            const canvas =
                this.gpsTracker.canvas;

            const gridSpacing =
                this.getGridSpacing();

            ctx.strokeStyle =
                "#222";

            ctx.lineWidth = 1;

            ctx.font =
                "9px Arial, sans-serif";

            ctx.fillStyle =
                "#444";

            const maxXY =
                (
                    canvas.width -
                    this.gpsTracker.MARGIN * 2
                ) /
                this.gpsTracker.pixelsPerMeter;

            for (
                let x = 0;
                x <= maxXY;
                x += gridSpacing
            ) {

                const coords =
                    this.xyToCanvas(
                        x,
                        0
                    );

                ctx.beginPath();

                ctx.moveTo(
                    coords.canvasX,
                    this.gpsTracker.MARGIN
                );

                ctx.lineTo(
                    coords.canvasX,
                    canvas.height -
                    this.gpsTracker.MARGIN
                );

                ctx.stroke();

                ctx.fillText(
                    `${x}`,
                    coords.canvasX - 8,
                    canvas.height -
                    this.gpsTracker.MARGIN +
                    12
                );
            }

            for (
                let y = 0;
                y <= maxXY;
                y += gridSpacing
            ) {

                const coords =
                    this.xyToCanvas(
                        0,
                        y
                    );

                ctx.beginPath();

                ctx.moveTo(
                    this.gpsTracker.MARGIN,
                    coords.canvasY
                );

                ctx.lineTo(
                    canvas.width -
                    this.gpsTracker.MARGIN,
                    coords.canvasY
                );

                ctx.stroke();

                ctx.fillText(
                    `${y}`,
                    5,
                    coords.canvasY + 3
                );
            }
        },

        // =========================================================
        // DRAW AXES
        // =========================================================
        drawAxes() {

            const ctx =
                this.gpsTracker.ctx;

            const canvas =
                this.gpsTracker.canvas;

            ctx.strokeStyle =
                "#0084ffff";

            ctx.lineWidth = 2;

            /*
             * Tidak mengubah sistem koordinat trajectory.
             * GPS:
             *
             * Utara  = atas
             * Selatan = bawah
             * Timur = kanan
             * Barat = kiri
             */
        },

        // =========================================================
        // DRAW SHIP
        // =========================================================
        drawShipAtCurrentPosition() {

            const ctx =
                this.gpsTracker.ctx;

            const path =
                this.gpsTracker.path;

            if (
                path.length === 0
            ) {
                return;
            }

            if (
                !this.gpsTracker.shipImageLoaded
            ) {
                return;
            }

            const lastPoint =
                path[path.length - 1];

            const currentPos =
                this.xyToCanvas(
                    lastPoint.x,
                    lastPoint.y
                );

            const size =
                this.gpsTracker.shipImageSize;

            // =====================================================
            // AMBIL HEADING KOMPAS
            // =====================================================
            let headingDeg =
                this.vehicleData.heading;

            if (
                headingDeg === null ||
                headingDeg === undefined ||
                !Number.isFinite(
                    Number(headingDeg)
                )
            ) {

                headingDeg =
                    this.gpsTracker.lastHeading;

            }

            // Kalau tetap tidak ada heading
            if (
                headingDeg === null ||
                headingDeg === undefined ||
                !Number.isFinite(
                    Number(headingDeg)
                )
            ) {

                headingDeg = 0;
            }

            headingDeg =
                this.normalizeHeading(
                    headingDeg
                );

            // Simpan heading terakhir
            this.gpsTracker.lastHeading =
                headingDeg;

            // =====================================================
            // HEADING -> RADIAN
            // =====================================================
            const rotationDeg =
                headingDeg +
                this.gpsTracker.SHIP_HEADING_OFFSET;

            const headingRad =
                rotationDeg *
                Math.PI /
                180;

            // =====================================================
            // DRAW SHIP
            // =====================================================
            ctx.save();

            ctx.translate(
                currentPos.canvasX,
                currentPos.canvasY
            );

            ctx.rotate(
                headingRad
            );

            ctx.drawImage(
                this.gpsTracker.shipImage,
                -size / 2,
                -size / 2,
                size,
                size
            );

            ctx.restore();

            // =====================================================
            // DEBUG HEADING
            // =====================================================
            this.drawHeadingInfo(
                currentPos.canvasX,
                currentPos.canvasY,
                headingDeg
            );
        },

        // =========================================================
        // DRAW HEADING TEXT
        // =========================================================
        drawHeadingInfo(
            x,
            y,
            heading
        ) {

            const ctx =
                this.gpsTracker.ctx;

            ctx.save();

            ctx.fillStyle =
                "#000";

            ctx.font =
                "bold 11px Arial, sans-serif";

            ctx.textAlign =
                "left";

            ctx.fillText(
                `HDG ${heading.toFixed(1)}°`,
                x + 38,
                y + 5
            );

            ctx.restore();
        },

        // =========================================================
        // DRAW PATH
        // =========================================================
        drawPath() {

            const ctx =
                this.gpsTracker.ctx;

            const path =
                this.gpsTracker.path.map(
                    (p) => ({
                        ...p,
                        ...this.xyToCanvas(
                            p.x,
                            p.y
                        ),
                    })
                );

            if (
                path.length === 0
            ) {
                return;
            }

            // =====================================================
            // TRAJECTORY LINE
            // =====================================================
            ctx.beginPath();

            path.forEach(
                (p, i) => {

                    if (i === 0) {

                        ctx.moveTo(
                            p.canvasX,
                            p.canvasY
                        );

                    } else {

                        ctx.lineTo(
                            p.canvasX,
                            p.canvasY
                        );
                    }
                }
            );

            ctx.strokeStyle =
                "#00aaff";

            ctx.lineWidth = 3;

            ctx.lineJoin =
                "round";

            ctx.lineCap =
                "round";

            ctx.stroke();

            // =====================================================
            // PATH POINTS
            // =====================================================
            path.forEach(
                (p, i) => {

                    const isLast =
                        i === path.length - 1;

                    ctx.beginPath();

                    ctx.arc(
                        p.canvasX,
                        p.canvasY,
                        3,
                        0,
                        2 * Math.PI
                    );

                    ctx.fillStyle =
                        "#00e1ffff";

                    ctx.fill();

                    // =================================================
                    // COORDINATE LABEL
                    // =================================================
                    if (isLast) {

                        ctx.strokeStyle =
                            "#000000ff";

                        ctx.lineWidth =
                            1.5;

                        ctx.fillStyle =
                            "#ff0000";

                        ctx.font =
                            "bold 10px Arial, sans-serif";

                        ctx.fillText(
                            `(${p.x.toFixed(1)},${p.y.toFixed(1)})`,
                            p.canvasX + 12,
                            p.canvasY - 10
                        );
                    }
                }
            );
        },

        // =========================================================
        // GPS UPDATE FROM VEHICLE
        // =========================================================
        updateGPSFromVehicle() {

            const lat =
                Number(
                    this.vehicleData.lat
                );

            const lon =
                Number(
                    this.vehicleData.lon
                );

            // Tracking belum aktif
            if (
                !this.gpsTracker.isTracking
            ) {
                return;
            }

            // GPS invalid
            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon) ||
                lat === 0 ||
                lon === 0
            ) {
                return;
            }

            this.updateGPSPosition();
        },

        // =========================================================
        // UPDATE GPS POSITION
        // =========================================================
        updateGPSPosition() {

            const lat =
                Number(
                    this.vehicleData.lat
                );

            const lon =
                Number(
                    this.vehicleData.lon
                );

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon) ||
                lat === 0 ||
                lon === 0
            ) {
                return;
            }

            const timestamp =
                Date.now();

            // =====================================================
            // SET ORIGIN
            // =====================================================
            if (
                !this.gpsTracker.originGPS
            ) {

                this.gpsTracker.originGPS = {
                    lat,
                    lon,
                };

                this.gpsTracker.startTime =
                    timestamp;

                toastr.success(
                    "Origin GPS ditetapkan dari vehicleData!"
                );
            }

            // =====================================================
            // CHECK DISTANCE
            // =====================================================
            if (
                this.gpsTracker.path.length >
                0
            ) {

                const last =
                    this.gpsTracker.path[
                    this.gpsTracker.path.length - 1
                    ];

                const dist =
                    this.calculateDistance(
                        last.lat,
                        last.lon,
                        lat,
                        lon
                    );

                /*
                 * GPS noise filter.
                 *
                 * Hanya trajectory yang difilter.
                 *
                 * Heading tetap bisa berubah
                 * walaupun kapal tidak bergerak.
                 */
                if (dist < 0.5) {

                    // Tetap redraw supaya
                    // kapal mengikuti heading kompas
                    this.drawGPSCanvas();

                    return;
                }

                this.gpsTracker.totalDistance +=
                    dist;
            }

            // =====================================================
            // CONVERT GPS -> XY
            // =====================================================
            const xy =
                this.gpsToLocalXY(
                    lat,
                    lon
                );

            // =====================================================
            // ADD PATH
            // =====================================================
            this.gpsTracker.path.push({

                x: xy.x,
                y: xy.y,

                lat,
                lon,

                timestamp,

                accuracy: 1.0,

                speed:
                    Number(
                        this.vehicleData.speed_mps ??
                        0
                    ),
            });

            this.gpsTracker.lastUpdateTime =
                timestamp;

            // =====================================================
            // DRAW
            // =====================================================
            this.drawGPSCanvas();
        },

        // =========================================================
        // DISTANCE HAVERSINE
        // =========================================================
        calculateDistance(
            lat1,
            lon1,
            lat2,
            lon2
        ) {

            const dLat =
                (
                    lat2 - lat1
                ) *
                Math.PI /
                180;

            const dLon =
                (
                    lon2 - lon1
                ) *
                Math.PI /
                180;

            const a =
                Math.sin(
                    dLat / 2
                ) ** 2 +

                Math.cos(
                    lat1 *
                    Math.PI /
                    180
                ) *

                Math.cos(
                    lat2 *
                    Math.PI /
                    180
                ) *

                Math.sin(
                    dLon / 2
                ) ** 2;

            return (
                this.gpsTracker.EARTH_RADIUS *
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                )
            );
        },

        // =========================================================
        // SCALE INFO
        // =========================================================
        updateScaleInfo() {

            const viewRange =
                (
                    this.gpsTracker.canvas.width -
                    this.gpsTracker.MARGIN * 2
                ) /
                this.gpsTracker.pixelsPerMeter;

            const scaleText =
                `${this.getGridSpacing()} m/div`;

            const rangeText =
                `${viewRange.toFixed(0)} m x ${viewRange.toFixed(0)} m`;

            const ctx =
                this.gpsTracker.ctx;

            ctx.fillStyle =
                "#000000ff";

            ctx.font =
                "10px Arial, sans-serif";

            ctx.fillText(
                scaleText,
                10,
                this.gpsTracker.canvas.height - 25
            );

            ctx.fillText(
                rangeText,
                10,
                this.gpsTracker.canvas.height - 10
            );
        },

        // =========================================================
        // START GPS TRACKING
        // =========================================================
        startGPSTracking() {

            // Already tracking
            if (
                this.gpsTracker.isTracking
            ) {

                console.log(
                    "GPS already tracking"
                );

                toastr.info(
                    "GPS Tracking already active"
                );

                return;
            }

            // =====================================================
            // GET VEHICLE GPS
            // =====================================================
            const lat =
                Number(
                    this.vehicleData.lat
                );

            const lon =
                Number(
                    this.vehicleData.lon
                );

            console.log(
                "START clicked - GPS Data:",
                {
                    lat,
                    lon,
                }
            );

            // =====================================================
            // VALIDATE GPS
            // =====================================================
            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon) ||
                lat === 0 ||
                lon === 0
            ) {

                console.warn(
                    "GPS data not ready:",
                    {
                        lat,
                        lon,
                    }
                );

                toastr.warning(
                    "Waiting for valid GPS data from vehicle...",
                    "Please Wait",
                    {
                        timeOut: 3000,
                    }
                );

                if (
                    !this.gpsTracker.retryCount
                ) {
                    this.gpsTracker.retryCount =
                        0;
                }

                this.gpsTracker.retryCount++;

                if (
                    this.gpsTracker.retryCount <
                    10
                ) {

                    console.log(
                        `Retry ${this.gpsTracker.retryCount}/10 in 2 seconds...`
                    );

                    setTimeout(
                        () => {
                            this.startGPSTracking();
                        },
                        2000
                    );

                } else {

                    console.error(
                        "Max retry reached. GPS data still not available."
                    );

                    toastr.error(
                        "Cannot start tracking. GPS data not available.",
                        "Error"
                    );

                    this.gpsTracker.retryCount =
                        0;
                }

                return;
            }

            // Reset retry
            this.gpsTracker.retryCount =
                0;

            // =====================================================
            // SET ORIGIN
            // =====================================================
            this.gpsTracker.originGPS = {
                lat,
                lon,
            };

            this.gpsTracker.startTime =
                Date.now();

            this.gpsTracker.lastUpdateTime =
                Date.now();

            // =====================================================
            // TRACKING ON
            // =====================================================
            this.gpsTracker.isTracking =
                true;

            // =====================================================
            // SAVE CURRENT HEADING
            // =====================================================
            const heading =
                this.normalizeHeading(
                    this.vehicleData.heading
                );

            if (
                heading !== null
            ) {

                this.gpsTracker.lastHeading =
                    heading;
            }

            // =====================================================
            // INITIAL PATH
            // =====================================================
            this.gpsTracker.path = [
                {
                    x: 0,
                    y: 0,
                    lat,
                    lon,
                    timestamp: Date.now(),
                    accuracy: 1.0,
                    speed:
                        Number(
                            this.vehicleData.speed_mps ??
                            0
                        ),
                },
            ];

            // =====================================================
            // DRAW
            // =====================================================
            this.drawGPSCanvas();

            console.log(
                "✓ GPS Tracking started - Origin set:",
                this.gpsTracker.originGPS
            );

            toastr.success(
                `Origin GPS set!\nLat: ${lat.toFixed(6)}\nLon: ${lon.toFixed(6)}`,
                "GPS Started!",
                {
                    timeOut: 5000,
                }
            );

            /*
             * =====================================================
             * IMPORTANT
             * =====================================================
             *
             * Browser GPS TIDAK digunakan sebagai sumber utama.
             *
             * Karena kapal menggunakan GPS dari backend:
             *
             * API telemetry
             *       ↓
             * vehicleData.lat/lon
             *
             * Jadi tidak perlu navigator.geolocation.watchPosition().
             */
        },

        // =========================================================
        // STOP GPS
        // =========================================================
        stopGPSTracking() {

            if (
                this.gpsTracker.watchId !== null
            ) {

                navigator.geolocation.clearWatch(
                    this.gpsTracker.watchId
                );

                this.gpsTracker.watchId =
                    null;
            }

            this.gpsTracker.isTracking =
                false;

            toastr.info(
                "Tracking stopped"
            );
        },

        // =========================================================
        // CLEAR GPS
        // =========================================================
        clearGPSPath() {

            if (
                !confirm(
                    "Clear GPS data?"
                )
            ) {
                return;
            }

            if (
                this.gpsTracker.isTracking
            ) {

                this.stopGPSTracking();
            }

            Object.assign(
                this.gpsTracker,
                {

                    path: [],

                    originGPS: null,

                    totalDistance: 0,

                    startTime: null,

                    lastUpdateTime: null,

                    retryCount: 0,

                    lastHeading: null,
                }
            );

            this.drawGPSCanvas();

            toastr.success(
                "GPS data cleared"
            );

            // Restart
            this.startGPSTracking();
        },

        // =========================================================
        // WAKE LOCK
        // =========================================================
        async requestWakeLock() {

            try {

                if (
                    "wakeLock" in navigator
                ) {

                    this.gpsTracker.wakeLock =
                        await navigator.wakeLock.request(
                            "screen"
                        );

                    console.log(
                        "Wake Lock active"
                    );
                }

            } catch (error) {

                console.log(
                    "Wake lock unsupported"
                );
            }
        },
    };
};
