import React, { useState, useEffect } from 'react';
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View ,Text} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as tf from '@tensorflow/tfjs';
import * as FileSystem from 'expo-file-system';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import axios from 'axios';
import Button from './components/Button';
import ImageViewer from './components/ImageViewer';
import * as jpeg from 'jpeg-js';
import * as ImageManipulator from 'expo-image-manipulator';
//import * as Base64 from 'expo-base64';

const PlaceholderImage = require("./assets/images/background-image.png");
export default function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);

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
      alert('You did not select any image.');
    }
  };
  const preprocessImage = async (imageUri) => {
    try {
      targetSize = 128
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 128, height: 128 } }],
        //{ compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      print('done processedImage')
      // // Đọc hình ảnh từ đường dẫn imageUri dưới dạng chuỗi Base64
      // console.log('preprocessImage')
       const imgB64 = await FileSystem.readAsStringAsync(processedImage.uri, {
         encoding: FileSystem.EncodingType.Base64,
       });
      // console.log('preprocessImage 1')
      // // Chuyển đổi chuỗi Base64 thành array
      //const imgBuffer = Buffer.from(imgB64, 'base64');
      const imageArray = base64ToArray(imgB64);
      console.log(imageArray)
      // console.log('preprocessImage 2')
      // // Giải mã hình ảnh JPEG thành tensor
      console.log('decode')
      const rawImageData = jpeg.decode(processedImage, { useTArray: true });
      console.log(rawImageData)
      // let imageTensor = decodeJpeg(rawImageData);
      // console.log('preprocessImage 3')
      // // Resize hình ảnh đến kích thước mục tiêu
      // imageTensor = tf.image.resizeBilinear(imageTensor, [targetSize, targetSize]);

      // // Chuẩn hóa hình ảnh (đưa giá trị pixel về khoảng [0, 1])
      // imageTensor = imageTensor.div(tf.scalar(255));
      // console.log(imageTensor)
      // // Mở rộng kích thước của tensor để phù hợp với đầu vào của model
      //return imageTensor.expandDims(0); // Mở rộng kích thước của tensor
      return ;
      //Tạo một tensor từ dữ liệu hình ảnh
    // const imageTensor = tf.node.decodeImage(new Uint8Array(Buffer.from(imgB64, 'base64')), 3); // 3 channels for RGB

    // // Resize hình ảnh đến kích thước mục tiêu
    // const resizedImage = tf.image.resizeBilinear(imageTensor, [IMAGE_SIZE, IMAGE_SIZE]);

    // // Chuẩn hóa hình ảnh (đưa giá trị pixel về khoảng [0, 1])
    // const normalizedImage = resizedImage.div(tf.scalar(255));

    // // Mở rộng kích thước của tensor để phù hợp với đầu vào của model
    // return normalizedImage.expandDims(0);

    } catch (error) {
      console.error('Error preprocessing image:', error);
      return null;
    }
  };
  const base64ToArray = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const transformImageToTensor = async (uri)=>{
    //.ts: const transformImageToTensor = async (uri:string):Promise<tf.Tensor>=>{
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

    console.log("predictImage");
    console.log(selectedImage);
    //const preprocessedImage = await preprocessImage(selectedImage);
    const preprocessedImage = await transformImageToTensor(selectedImage);
    //console.log(preprocessedImage)
    if (preprocessedImage) {
      // Chuyển đổi tensor thành array
      //const imageArray = preprocessedImage.arraySync();
      
      // Tạo payload cho yêu cầu
      const payload = {
        instances: [preprocessedImage]
      };

      try {
        const result = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
        console.log(result.data);
        const headers = {
          'Content-Type': 'application/json'
        }
        const response = await axios.post('http://192.168.69.106:8501/v1/models/saved_model/versions/2:predict', payload,{headers});
        
        console.log('Prediction:', response.data);
        // Xử lý kết quả từ API response
        const predictions = response.data.predictions;
        const class_names = ['drunk', 'un_drunk'];
        
        const predicted_class = class_names[predictions[0].indexOf(Math.max(...predictions[0]))];
        console.log(predicted_class)
        setPrediction(predicted_class)
        const confidence = Math.round(100 * Math.max(...predictions[0]) *100) /100;
        console.log(confidence)
        setConfidence(confidence);
      } catch (error) {
        console.error('Error making prediction:', error);
      }
    }
  }
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <ImageViewer
          placeholderImageSource={PlaceholderImage}
          selectedImage={selectedImage}
        />
      </View>
      <View style={styles.predictionContainer}>
          <Text style={styles.predictionText}>Dự đoán: {prediction}</Text>
          <Text style={styles.predictionText}>% Dự đoán: {confidence}</Text>
        </View>
      <View style={styles.footerContainer}>
        <Button theme="primary" label="Choose a photo" onPress={pickImageAsync} />
        <Button label="Predict" theme="primary" onPress={predictImage} />
      </View>
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
    paddingTop: 58,
  },
  footerContainer: {
    flex: 1 / 3,
    alignItems: 'center',
  },
  predictionText: {
    fontSize: 25,
    fontWeight: 'bold',
    color : 'red'
  },
});
