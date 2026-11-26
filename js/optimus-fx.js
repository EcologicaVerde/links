(function(global) {
    'use strict';

    var GLYPHS = ['·', '+', '×', '├', '│', '◦', '0', '1', ':', '/'];

    function parseRgb(rgbStr) {
        var parts = rgbStr.split(',').map(function(n) { return parseFloat(n.trim()); });
        return { r: parts[0] || 74, g: parts[1] || 222, b: parts[2] || 128 };
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    var OptimusStageFX = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.width = 0;
        this.height = 0;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.spherePoints = [];
        this.particles = [];
        this.primary = { r: 74, g: 222, b: 128 };
        this.targetPrimary = { r: 74, g: 222, b: 128 };
        this.pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
        this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.time = 0;
        this.rafId = null;

        if (this.ctx) {
            this.resize();
            this.seedSphere();
            this.seedParticles();
            this.bindEvents();
            this.start();
        }
    };

    OptimusStageFX.prototype.bindEvents = function() {
        var self = this;
        window.addEventListener('resize', function() {
            self.resize();
            self.seedParticles();
        });
        window.addEventListener('pointermove', function(e) {
            if (window.innerWidth > 0 && window.innerHeight > 0) {
                self.pointer.tx = e.clientX / window.innerWidth;
                self.pointer.ty = e.clientY / window.innerHeight;
            }
        }, { passive: true });
    };

    OptimusStageFX.prototype.resize = function() {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = Math.floor(this.width * this.dpr);
        this.canvas.height = Math.floor(this.height * this.dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    };

    // Fibonacci lattice sphere inspired by Optimus 3D generative ASCII sphere
    OptimusStageFX.prototype.seedSphere = function() {
        var count = 210;
        var goldenAngle = Math.PI * (3 - Math.sqrt(5));
        this.spherePoints = [];
        for (var i = 0; i < count; i++) {
            var y = 1 - (i / (count - 1)) * 2;
            var r = Math.sqrt(Math.max(0, 1 - y * y));
            var theta = goldenAngle * i;
            this.spherePoints.push({
                x: Math.cos(theta) * r,
                y: y,
                z: Math.sin(theta) * r,
                glyph: GLYPHS[i % GLYPHS.length]
            });
        }
    };

    OptimusStageFX.prototype.seedParticles = function() {
        var count = this.reducedMotion ? 10 : (this.width < 768 ? 26 : 44);
        this.particles = [];
        for (var i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vy: -(0.22 + Math.random() * 0.55),
                vx: (Math.random() - 0.5) * 0.25,
                size: 1 + Math.random() * 1.8,
                alpha: 0.2 + Math.random() * 0.45,
                phase: Math.random() * Math.PI * 2
            });
        }
    };

    OptimusStageFX.prototype.setScene = function(scene) {
        if (!scene) return;
        this.targetPrimary = parseRgb(scene.accentRgb);
    };

    OptimusStageFX.prototype.drawAsciiSphere = function(ctx, r, g, b) {
        var sphereRadius = Math.min(this.width, this.height) * (this.width < 768 ? 0.36 : 0.43);
        var cx = this.width < 768 ? this.width * 0.5 : this.width * 0.80;
        var cy = this.height * 0.52;

        var rotY = this.time * (this.reducedMotion ? 0.04 : 0.24) + (this.pointer.x - 0.5) * 0.6;
        var rotX = 0.25 + (this.pointer.y - 0.5) * 0.35;
        var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        var cosX = Math.cos(rotX), sinX = Math.sin(rotX);

        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (var i = 0; i < this.spherePoints.length; i++) {
            var pt = this.spherePoints[i];
            var x1 = pt.x * cosY - pt.z * sinY;
            var z1 = pt.z * cosY + pt.x * sinY;
            var y2 = pt.y * cosX - z1 * sinX;
            var z2 = z1 * cosX + pt.y * sinX;

            if (z2 < -0.55) continue;
            var depth = (z2 + 1) * 0.5;
            var px = cx + x1 * sphereRadius;
            var py = cy + y2 * sphereRadius;
            var alpha = 0.08 + depth * 0.34;
            ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
            ctx.fillText(pt.glyph, px, py);
        }
    };

    OptimusStageFX.prototype.step = function() {
        var ctx = this.ctx;
        this.time += 0.016;

        this.primary.r = lerp(this.primary.r, this.targetPrimary.r, 0.12);
        this.primary.g = lerp(this.primary.g, this.targetPrimary.g, 0.12);
        this.primary.b = lerp(this.primary.b, this.targetPrimary.b, 0.12);

        this.pointer.x = lerp(this.pointer.x, this.pointer.tx, 0.05);
        this.pointer.y = lerp(this.pointer.y, this.pointer.ty, 0.05);

        var r = Math.round(this.primary.r);
        var g = Math.round(this.primary.g);
        var b = Math.round(this.primary.b);

        ctx.clearRect(0, 0, this.width, this.height);

        // Keep background spotlight strictly in Ecológica Verde emerald so wallpaper hue stays dark green
        var px = this.pointer.x * this.width;
        var py = this.pointer.y * this.height;
        var rad = Math.max(this.width, this.height) * 0.45;
        var grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
        grad.addColorStop(0, 'rgba(74, 222, 128, 0.075)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        this.drawAsciiSphere(ctx, 74, 222, 128);

        // Ambient spores stay emerald green over the wallpaper
        var speed = this.reducedMotion ? 0.25 : 1;
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            p.y += p.vy * speed;
            p.x += (p.vx + Math.sin(this.time + p.phase) * 0.15) * speed;
            if (p.y < -15) {
                p.y = this.height + 15;
                p.x = Math.random() * this.width;
            }
            var alpha = p.alpha * (0.65 + 0.35 * Math.sin(this.time * 2 + p.phase));
            ctx.fillStyle = 'rgba(74, 222, 128,' + alpha.toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        var self = this;
        this.rafId = requestAnimationFrame(function() { self.step(); });
    };

    OptimusStageFX.prototype.start = function() {
        if (!this.rafId) {
            var self = this;
            this.rafId = requestAnimationFrame(function() { self.step(); });
        }
    };

    global.OptimusStageFX = OptimusStageFX;
})(window);
