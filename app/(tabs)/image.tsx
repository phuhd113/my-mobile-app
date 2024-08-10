import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet,ActivityIndicator  } from 'react-native';
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from 'expo-image-picker';
import * as tf from '@tensorflow/tfjs';
import * as FileSystem from 'expo-file-system';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import axios from 'axios';
import Button from '../../components/Button';
import ImageViewer from '../../components/ImageViewer';
import * as jpeg from 'jpeg-js';
import * as ImageManipulator from 'expo-image-manipulator';


const PlaceholderImage = require("../../assets/images/background-image.png");
export default function Tab() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const class_names = ['Say rượu', 'Tỉnh táo'];

  useEffect(() => {
    (async () => {
      await tf.ready(); // Đảm bảo TensorFlow.js đã sẵn sàng
      console.log("TensorFlow is ready");
    })();
  }, []);

  const pickImageAsync = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      console.log("Select Image")
      console.log(result.assets[0].height)
      console.log(result.assets[0].width)
       // Cắt hình ảnh sau khi chọn
       const croppedImage = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [
          {
            resize: {
              width: 480,
              height: 640,
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      //setSelectedImage(result.assets[0].uri);
      setSelectedImage(croppedImage.uri);
    } else {
      alert('Đã có lỗi xảy ra khi chọn hình ảnh.');
    }
  };

  const transformImageToTensor = async (uri)=>{
    //read the image as base64
      const img64 = await FileSystem.readAsStringAsync(uri, {encoding:FileSystem.EncodingType.Base64})
      console.log('Done image 64')
      const imgBuffer =  tf.util.encodeString(img64, 'base64').buffer
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

  const predictImage = async () => {
    if (!selectedImage) return;
    setLoading(true); // Bắt đầu biểu tượng tải
    console.log("predictImage");
    console.log(selectedImage);
    const preprocessedImage = await transformImageToTensor(selectedImage);
    if (preprocessedImage) {     
      // Tạo payload cho yêu cầu
      const payload = {
        instances: [preprocessedImage]
      };

      try {
        const headers = {
          'Content-Type': 'application/json'
        }
        const response = await axios.post('http://192.168.69.113:8501/v1/models/saved_model/versions/5:predict', payload,{headers});
        
        console.log('Prediction:', response.data);
        // Xử lý kết quả từ API response
        const predictions = response.data.predictions;
        // Giả sử rằng predictions[0][0] là xác suất dự đoán của lớp 1 (Tỉnh táo)
        const probability = predictions[0][0];
        console.log('probability' + probability)
        const predicted_class = probability > 0.5 ? class_names[1] : class_names[0]; // Ngưỡng 0.5 để phân loại

        console.log(predicted_class);
        setPrediction(predicted_class);

        // Tính toán độ tin cậy (confidence)
        const confidence = probability > 0.5 ? Math.round(probability * 100) : 100 - Math.round(probability * 100); // Chuyển đổi xác suất thành phần trăm
        console.log(confidence);
        setConfidence(confidence);
        
        // const predicted_class = class_names[predictions[0].indexOf(Math.max(...predictions[0]))];
        // console.log(predicted_class)
        // setPrediction(predicted_class)
        // const confidence = Math.round(100 * Math.max(...predictions[0]) *100) /100;
        // console.log(confidence)
        // setConfidence(confidence);
      } catch (error) {
        console.error('Error making prediction:', error);
      }finally{
        setLoading(false); // Kết thúc biểu tượng tải
      }
    }
  };
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <ImageViewer
          placeholderImageSource={PlaceholderImage}
          selectedImage={selectedImage}
        />
      </View>
      <View style={styles.predictionContainer}>
         
          <>
            <Text style={styles.predictionText}>Dự đoán:  <Text style={{ color: prediction === 'Tỉnh táo' ? 'green' : 'red' }}>{prediction}</Text></Text>
            <Text style={styles.predictionText}>Độ chính xác: {confidence} %</Text>
          </>
        </View>
      <View style={styles.footerContainer}>
        <Button theme="primary" label="Chọn hình ảnh" onPress={pickImageAsync} />
        <Button label="Dự đoán" theme="primary" onPress={predictImage} />
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ff00" />
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    //paddingTop: 58,
  },
  footerContainer: {
    flex: 1 / 3,
    alignItems: 'center',
  },
  predictionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color : 'white'
  },
  predictionContainer : {
  },
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

