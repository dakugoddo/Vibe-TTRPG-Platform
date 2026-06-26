---
type: canvas
schemaVersion: 1
id: root
properties:
  drawElements:
    - id: preview_welcome_panel
      type: rectangle
      x: -360
      y: -180
      width: 720
      height: 360
      stroke: "#38bdf8"
      strokeWidth: 2
      strokeStyle: solid
      opacity: 1
      fillOpacity: 1
      strokeOpacity: 1
      fill: "#0f172acc"
      textColor: "#e0f2fe"
      textOpacity: 1
      fontSize: 22
      fontFamily: sans
      textAlign: center
      zIndex: 1
      description: "Eternity Table Preview World\nCanvas + Notes + Entities + Assets-ready local-first workflow"
    - id: preview_note_card
      type: rectangle
      x: -320
      y: 230
      width: 280
      height: 150
      stroke: "#f59e0b"
      strokeWidth: 2
      strokeStyle: solid
      opacity: 1
      fillOpacity: 1
      strokeOpacity: 1
      fill: "#451a03aa"
      textColor: "#fef3c7"
      textOpacity: 1
      fontSize: 16
      fontFamily: sans
      textAlign: center
      zIndex: 2
      description: "Try Notes mode: open Codex of the First Gate"
    - id: preview_canvas_arrow
      type: line
      points: [-40, 305, 160, 305]
      stroke: "#a78bfa"
      strokeWidth: 4
      strokeStyle: solid
      opacity: 1
      strokeOpacity: 1
      startCap: none
      endCap: arrow
      zIndex: 3
---

# Preview Canvas

This bundled canvas is copied to a temporary folder when opened from the login screen.
