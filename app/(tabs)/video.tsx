import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Button from '../../components/Button';
import VideoViewer from '../../components/VideoViewer';
import ImageViewer from '../../components/ImageViewer';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import axios from 'axios';
import * as SplashScreen from 'expo-splash-screen';
import * as ImageManipulator from 'expo-image-manipulator';

// Keep the splash screen visible while we fetch resources
//SplashScreen.preventAutoHideAsync();
const PlaceholderImage = require("../../assets/images/background-image.png");
export default function Tab() {
  // Lưu video
  const [selectedVideo, setSelectedVideo] = useState(null);
  // Lưu hình ảnh đã cắt
  const [images, setImages] = useState([]);
  // Lưu kết quả đã dự đoán
  const [predictResults, setPredictResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const class_names = ['Say rượu', 'Tỉnh táo'];
  const [predictCore, setPredictCore] = useState({});
  const [loadVideo, setLoadVideo] = useState(true);

// Load video đã chọn
  const pickVideoAsync = async () => {
    try {
      setLoading(true);
      await SplashScreen.preventAutoHideAsync();
      let video = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });
      if (!video.canceled) {
        console.log("Selected Video")
        setSelectedVideo(video.assets[0].uri);
        await extractFrames(video.assets[0].uri);
        console.log(images.length);
        await SplashScreen.hideAsync();
        setPredictCore({})
      } else {
        alert('Đã có lỗi xảy ra khi chọn video.');
      }
    } catch {
      alert('Đã có lỗi xảy ra khi chọn video.');
    }
    finally {
      setLoadVideo(true);
      setLoading(false);
    }
  }


  const extractFrames = async (videoUri) => {
    const extractedImages = [];
    for (let i = 1; i < 8; i++) {
      try {
        // Cắt hình ảnh sau khi chọn

        const { uri } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          {
            time: i * 1000, // Lấy hình ảnh mỗi giây
          }
        );
        extractedImages.push(uri);
      } catch (e) {
        console.warn(e);
        break; // Nếu có lỗi (ví dụ video ngắn hơn 5 giây), thoát vòng lặp
      }
    }
    setImages(extractedImages);
  };

  const transformImageToTensor = async (uri) => {
    //read the image as base64
    //let test = await FileSystem.read(uri)
    const img64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    console.log(img64.length)
    console.log('Done image 64')
    const imgBuffer = tf.util.encodeString(img64, 'base64').buffer
    console.log('Done buffer')
    const raw = new Uint8Array(imgBuffer)
    console.log('Done Uint8Array')
    let imgTensor = decodeJpeg(raw)
    console.log('Done decodeJpeg')
    const scalar = tf.scalar(255)
    //resize the image
    imgTensor = tf.image./*resizeNearestNeighbor*/resizeBilinear(imgTensor, [224, 224])
    console.log('Done resizeNearestNeighbor')
    //normalize; if a normalization layer is in the model, this step can be skipped
    const tensorScaled = imgTensor.div(scalar)
    console.log('Done tensorScaled')
    //final shape of the rensor
    //const img = tf.reshape(tensorScaled, [1,300,300,3])
    const imageArray = tensorScaled.arraySync();
    //console.log(imageArray)
    return imageArray
  };
  const processImages = async () => {
    try {
      setLoading(true);
      const tensorPromises = images.map(uri => transformImageToTensor(uri));
      const tensors = await Promise.all(tensorPromises);

      const predictionPromises = tensors.map(tensor => callPredictAPI(tensor));
      const predictions = await Promise.all(predictionPromises);
      console.log(predictions)
      setPredictResults(predictions);
      //const rmse = calculateRMSE(predictions);
      const wa = calculateWeightedAverage(predictions);
      console.log(wa);
      setPredictCore(wa);

    } catch (error) {
      console.error(error);
    } finally {
      setLoadVideo(false);
      setLoading(false);
    }
  };
  const callPredictAPI = async (tensorImage) => {
    await SplashScreen.preventAutoHideAsync();
    if (!tensorImage) return;
    // Tạo payload cho yêu cầu
    const payload = {
      instances: [tensorImage]
    };

    try {
      const headers = {
        'Content-Type': 'application/json'
      }
      const response = await axios.post('http://192.168.69.113:8501/v1/models/saved_model/versions/5:predict', payload, { headers });

      console.log('Prediction:', response.data);
      // Xử lý kết quả từ API response
      const predictions = response.data.predictions;

      // Giả sử rằng predictions[0][0] là xác suất dự đoán của lớp 1 (Tỉnh táo)
      const probability = predictions[0][0];
      console.log('probability' + probability)
      const predicted_class = probability > 0.5 ? class_names[1] : class_names[0]; // Ngưỡng 0.5 để phân loại

      console.log(predicted_class);

      // Tính toán độ tin cậy (confidence)
      const confidence = probability > 0.5 ? Math.round(probability * 100) : 100 - Math.round(probability * 100); // Chuyển đổi xác suất thành phần trăm
      // const predicted_class = class_names[predictions[0].indexOf(Math.max(...predictions[0]))];
      // console.log(predicted_class)
      // const confidence = Math.round(100 * Math.max(...predictions[0]) * 100) / 100;
      // console.log(confidence)
      return { predicted_class, confidence };
    } catch (error) {
      console.error('Error making prediction:', error);
    }
  }
  const handleScrollEnd = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.floor(contentOffsetX / Dimensions.get('window').width);
    setCurrentIndex(index);
  };
  const calculateRMSE = (predictions) => {
    // Tạo đối tượng để lưu trữ các giá trị confidence theo từng nhóm predicted_class
    const confidenceGroups = {};

    // Lặp qua mảng predictions để gom nhóm theo predicted_class
    predictions.forEach(prediction => {
      const { predicted_class, confidence } = prediction;

      // Nếu nhóm chưa tồn tại, khởi tạo mảng rỗng
      if (!confidenceGroups[predicted_class]) {
        confidenceGroups[predicted_class] = [];
      }

      // Thêm confidence vào nhóm tương ứng
      confidenceGroups[predicted_class].push(confidence);
    });

    // Tính toán RMSE cho từng nhóm và lưu kết quả vào một đối tượng mới
    const rmseByClass = [];
    Object.keys(confidenceGroups).forEach(predicted_class => {
      const confidences = confidenceGroups[predicted_class];

      // Tính trung bình bình phương sai số
      const meanSquaredError = confidences.reduce((acc, confidence) => {
        return acc + Math.pow(confidence, 2);
      }, 0) / confidences.length;

      // Tính RMSE
      const rmse = Math.sqrt(meanSquaredError);

      // Lưu kết quả vào đối tượng rmseByClass
      rmseByClass.push({ predict: predicted_class, confidence: Math.round(rmse) });
    });
    if (rmseByClass.length > 1) {
      rmseByClass.sort(x => x.confidence);
      //rmseByClass.reverse();
      console.log(rmseByClass);
      return rmseByClass[0];
    } else {
      return rmseByClass[0];
    }
  };

  const calculateWeightedAverage = (predictions) => {
    // Tạo đối tượng để lưu trữ các giá trị confidence theo từng nhóm predicted_class
    const confidenceGroups = {};

    // Lặp qua mảng predictions để gom nhóm theo predicted_class
    predictions.forEach(prediction => {
        const { predicted_class, confidence } = prediction;

        // Nếu nhóm chưa tồn tại, khởi tạo mảng rỗng
        if (!confidenceGroups[predicted_class]) {
            confidenceGroups[predicted_class] = [];
        }

        // Thêm confidence vào nhóm tương ứng
        confidenceGroups[predicted_class].push(confidence);
    });

    // Tính toán trung bình có trọng số cho từng nhóm và lưu kết quả vào một đối tượng mới
    const weightedAverageByClass = [];
    Object.keys(confidenceGroups).forEach(predicted_class => {
        const confidences = confidenceGroups[predicted_class];

        // Tính tổng các giá trị confidence
        const totalConfidence = confidences.reduce((acc, confidence) => acc + confidence, 0);

        // Tính trung bình
        const averageConfidence = totalConfidence / confidences.length;

        // Lưu kết quả vào đối tượng weightedAverageByClass
        weightedAverageByClass.push({ predict: predicted_class, confidence: Math.round(averageConfidence) });
    });

    // Sắp xếp các nhóm theo giá trị trung bình confidence giảm dần và trả về nhóm có giá trị trung bình cao nhất
    if (weightedAverageByClass.length > 1) {
        weightedAverageByClass.sort((a, b) => b.confidence - a.confidence);
        console.log(weightedAverageByClass);
        return weightedAverageByClass[0];
    } else {
        return weightedAverageByClass[0];
    }
};

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {loadVideo ? (
          <View style={styles.videoContainer}>
            <VideoViewer
              placeholderVideoSource={PlaceholderImage}
              selectedVideo={selectedVideo}
            />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              style={styles.scrollView}
              onMomentumScrollEnd={handleScrollEnd}
            >
              {images.map((imageUri, index) => (
                <View key={index} style={styles.carouselItem}>
                  <Image source={{ uri: imageUri }} style={styles.image} />
                </View>
              ))}
            </ScrollView>
            <View style={styles.predictContainer}>
              {predictResults[currentIndex] !== undefined && (
                <Text style={styles.predictionText}>
                  Hình {currentIndex + 1}: {' '}
                  <Text style={{ color: predictResults[currentIndex]?.predicted_class === 'Tỉnh táo' ? 'green' : 'red' }}>{predictResults[currentIndex]?.predicted_class}</Text>
                  {' '} - {predictResults[currentIndex]?.confidence}%
                </Text>

              )}
            </View>
          </>
        )}
      </View>
      <View style={styles.summaryPreditctContainer}>
        <Text style={styles.predictionText}>Dự đoán:
          <Text style={{ color: predictCore['predict'] === 'Tỉnh táo' ? 'green' : 'red' }}>{'  ' + (predictCore['predict'] ?? '')}</Text>
        </Text>
        <Text style={styles.predictionText}>Độ chính xác: {predictCore['confidence'] !== undefined ? predictCore['confidence'] : ''} %</Text>
      </View>
      <View style={styles.footerContainer}>
        <Button theme="primary" label="Chọn Video" onPress={pickVideoAsync} />
        <Button label="Dự đoán" theme="primary" onPress={processImages} />
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ff00" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    paddingTop: 20,
  },
  footerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  predictionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white'
  },
  predictContainer: {
    alignItems: 'center',
  },
  scrollView: {
    //width: '100%',
    paddingTop: 20
  },
  carouselItem: {
    width: Dimensions.get('window').width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 320,
    height: '100%',
  },
  contentContainer: {
    flex: 3,
    width: '100%',
  },
  summaryPreditctContainer: {
    flex: 1 / 2
  }
  ,
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Làm mờ nền phía sau
  },
});
