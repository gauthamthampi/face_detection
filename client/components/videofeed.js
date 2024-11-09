'use client'
import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

const VideoFeed = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectionData, setDetectionData] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL); 
      setModelsLoaded(true);
    };

    loadModels();
  }, []);

  useEffect(() => {
    if (modelsLoaded) {
      startVideo();
    }
  }, [modelsLoaded]);

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: {} })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error('Error accessing webcam: ', err));
  };

  const handleVideoPlay = () => {
    if (!modelsLoaded) return;

    const displaySize = {
      width: videoRef.current.clientWidth,
      height: videoRef.current.clientHeight,
    };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    setInterval(async () => {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      });

      const detections = await faceapi
        .detectAllFaces(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      if (detections.length === 0) {
        setDetectionData(null); 
        return;
      }

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      resizedDetections.forEach(detection => {
        const landmarks = detection.landmarks;

        const jawOutline = landmarks.getJawOutline();
        drawPath(ctx, jawOutline, true);

        const leftEyebrow = landmarks.getLeftEyeBrow();
        drawPath(ctx, leftEyebrow, false);

        const rightEyebrow = landmarks.getRightEyeBrow();
        drawPath(ctx, rightEyebrow, false);

        const nose = landmarks.getNose();
        drawPath(ctx, nose, false);

        const leftEye = landmarks.getLeftEye();
        drawPath(ctx, leftEye, true);

        const rightEye = landmarks.getRightEye();
        drawPath(ctx, rightEye, true);

        const mouth = landmarks.getMouth();
        drawPath(ctx, mouth, true);
      });

      const data = resizedDetections.map(detection => {
        const { expressions, age, gender, genderProbability } = detection;
        return {
          confidence: (detection.detection.score * 100).toFixed(2),
          expressions: Object.entries(expressions)
            .filter(([_, probability]) => probability > 0.1)
            .map(([expression, probability]) => ({
              expression,
              probability: (probability * 100).toFixed(2),
            })),
          age: age.toFixed(0),
          gender: gender,
          genderConfidence: (genderProbability * 100).toFixed(2),
        };
      });

      setDetectionData(data);
    }, 100);
  };

  const drawPath = (ctx, points, closePath) => {
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;

    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    if (closePath) {
      ctx.closePath();
    }
    ctx.stroke();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 className='p-10'>Real-Time Face Detection with Face Outline</h1>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          width="520"
          height="260"
          onPlay={handleVideoPlay}
          style={{ borderRadius: '8px' }}
        />
        <canvas
          ref={canvasRef}
          width="520"
          height="260"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            borderRadius: '8px',
          }}
        />
      </div>
      <div style={{ marginTop: '20px', textAlign: 'center', width: '20%' }}>
        {detectionData ? (
          detectionData.map((data, index) => (
            <div key={index} style={{
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '10px',
              backgroundColor: 'grey'
            }}>
              <p><strong>Confidence:</strong> {data.confidence}%</p>
              <p><strong>Age:</strong> {data.age}</p>
              <p><strong>Gender:</strong> {data.gender} ({data.genderConfidence}%)</p>
              <div>
                <strong>Expressions:</strong>
                {data.expressions.map((expressionData, expIndex) => (
                  <p key={expIndex}>
                    {expressionData.expression}: {expressionData.probability}%
                  </p>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p>No faces detected.</p>
        )}
      </div>
    </div>
  );
};

export default VideoFeed;
