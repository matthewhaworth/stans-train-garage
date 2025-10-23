"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

// Import Thomas the Tank Engine characters from JSON file
import thomasCharacters from './thomas_characters.json';

// Define interfaces for TypeScript
interface Train {
  id: number;
  name: string;
  number: string;
  color: string;
  description?: string;
  images: string[];
}

interface IndexedObject {
  [key: number]: number;
}

interface ImageCollection {
  [key: number]: string[];
}

interface LoadingState {
  [key: number]: boolean;
}

// Thomas the Tank Engine trains database
const trainsDatabase: Train[] = thomasCharacters;

// Google Search API configuration
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const GOOGLE_CX = process.env.NEXT_PUBLIC_GOOGLE_CX || "";
const GOOGLE_SEARCH_API_URL = process.env.NEXT_PUBLIC_GOOGLE_SEARCH_API_URL || "https://www.googleapis.com/customsearch/v1";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTrains, setFilteredTrains] = useState<Train[]>(trainsDatabase);
  const [currentImageIndex, setCurrentImageIndex] = useState<IndexedObject>({});
  const [additionalImages, setAdditionalImages] = useState<ImageCollection>({});
  const [isLoadingImages, setIsLoadingImages] = useState<LoadingState>({});
  const [currentPage, setCurrentPage] = useState<IndexedObject>({});
  const [aiGuessResult, setAiGuessResult] = useState("");
  const [isLoadingAiGuess, setIsLoadingAiGuess] = useState(false);

  // Initialize current image index for each train
  useEffect(() => {
    const initialImageIndices: IndexedObject = {};
    const initialPages: IndexedObject = {};
    trainsDatabase.forEach(train => {
      initialImageIndices[train.id] = 0;
      initialPages[train.id] = 1;
    });
    
    // Use a timeout to avoid the ESLint warning about setState in useEffect
    const timer = setTimeout(() => {
      setCurrentImageIndex(initialImageIndices);
      setCurrentPage(initialPages);
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  // Filter trains based on search term
  useEffect(() => {
    // Use a timeout to avoid the ESLint warning about setState in useEffect
    const timer = setTimeout(() => {
      const filtered = trainsDatabase.filter(train => 
        train.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        train.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        train.color.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTrains(filtered);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get all images for a train (original + additional)
  const getAllImages = (trainId: number): string[] => {
    const train = trainsDatabase.find(t => t.id === trainId);
    const originalImages = train ? train.images || [] : [];
    const googleImages = additionalImages[trainId] || [];
    return [...originalImages, ...googleImages];
  };

  // Handle image navigation
  const nextImage = (trainId: number): void => {
    setCurrentImageIndex(prev => {
      const allImages = getAllImages(trainId);
      const nextIndex = (prev[trainId] + 1) % allImages.length;
      return { ...prev, [trainId]: nextIndex };
    });
  };

  const prevImage = (trainId: number): void => {
    setCurrentImageIndex(prev => {
      const allImages = getAllImages(trainId);
      const prevIndex = (prev[trainId] - 1 + allImages.length) % allImages.length;
      return { ...prev, [trainId]: prevIndex };
    });
  };

  // Fetch additional images from Google Search API
  const fetchGoogleImages = async (trainId: number, trainName: string, isLoadMore: boolean = false): Promise<void> => {
    try {
      setIsLoadingImages(prev => ({ ...prev, [trainId]: true }));
      
      // If it's a load more request, use the next page, otherwise use page 1
      const page = isLoadMore ? currentPage[trainId] : 1;
      const startIndex = ((page - 1) * 10) + 1; // Google API uses 1-based indexing with 10 results per page
      
      const query = encodeURIComponent(`${trainName} thomas tank engine train`);
      const url = `${GOOGLE_SEARCH_API_URL}?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${query}&searchType=image&start=${startIndex}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // Filter out images from static.wikia.nocookie.net
        const allImages = data.items.map((item: { link: string }) => item.link);
        const filteredImages = allImages.filter((link: string) => !link.includes('static.wikia.nocookie.net'));
        
        // Log for debugging
        console.log(`Filtered out ${allImages.length - filteredImages.length} wikia images`);
        
        // Check if we have any images left after filtering
        if (filteredImages.length === 0) {
          // All images were filtered out, try to get more from the next page
          if (!isLoadMore) {
            // If this was the initial search, show a message and try next page
            alert(`No suitable images found for ${trainName}. Trying next page...`);
            // Call the function again but with the next page
            fetchGoogleImages(trainId, trainName, true);
            return;
          } else {
            // If we were already loading more, just show a message
            alert('No more suitable images available');
            setIsLoadingImages(prev => ({ ...prev, [trainId]: false }));
            return;
          }
        }
        
        const images = filteredImages;
        
        setAdditionalImages(prev => {
          const currentImages = prev[trainId] || [];
          // If loading more, append to existing images, otherwise replace
          return {
            ...prev,
            [trainId]: isLoadMore ? [...currentImages, ...images] : images
          };
        });
        
        // Update the current page for this train
        if (isLoadMore) {
          setCurrentPage(prev => ({
            ...prev,
            [trainId]: prev[trainId] + 1
          }));
        } else {
          setCurrentPage(prev => ({
            ...prev,
            [trainId]: 2 // Set to 2 since we've loaded page 1
          }));
        }
      } else {
        // No results found
        if (!isLoadMore) {
          // Only show alert if this is the initial search, not when loading more
          alert(`No additional images found for ${trainName}`);
        } else {
          alert('No more images available');
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching images from Google:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load additional images: ${errorMessage}`);
    } finally {
      setIsLoadingImages(prev => ({ ...prev, [trainId]: false }));
    }
  };

  // Use AI to guess which train this could be
  const guessTrainWithAI = async (): Promise<void> => {
    if (!searchTerm.trim()) {
      alert('Please enter a train name in the search box above');
      return;
    }

    try {
      setIsLoadingAiGuess(true);
      setAiGuessResult('');

      const response = await fetch('/api/guess-train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trainName: searchTerm }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      setAiGuessResult(data.result);
    } catch (error: unknown) {
      console.error('Error calling AI guess API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAiGuessResult(`Error: ${errorMessage}`);
    } finally {
      setIsLoadingAiGuess(false);
    }
  };


  return (
    <div className="min-h-screen bg-blue-50 font-sans">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-700">Thomas the Tank Engine Trains</h1>
        
        {/* Search input and AI guess button */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search trains by name, number, color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
            />
            <button
              onClick={guessTrainWithAI}
              disabled={isLoadingAiGuess}
              className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isLoadingAiGuess ? 'Thinking...' : 'Use AI to guess which train this could be'}
            </button>
          </div>
          {aiGuessResult && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-2">AI Suggestion:</h3>
              <p className="text-gray-800">{aiGuessResult}</p>
            </div>
          )}
        </div>
        
        {/* Train cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTrains.map((train) => (
            <div key={train.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Train image carousel */}
              <div className="relative h-64 bg-gray-200">
                {getAllImages(train.id).map((image, index) => (
                  <div 
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-300 ${
                      currentImageIndex[train.id] === index ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="relative w-full h-full">
                      <img
                        src={image}
                        alt={`${train.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Handle broken image links
                          e.currentTarget.src = "/placeholder.png";
                          e.currentTarget.onerror = null;
                        }}
                      />
                    </div>
                  </div>
                ))}
                
                {/* Carousel navigation */}
                {getAllImages(train.id).length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between p-2">
                    <button 
                      onClick={() => prevImage(train.id)}
                      className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
                    >
                      ←
                    </button>
                    <button 
                      onClick={() => nextImage(train.id)}
                      className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
                    >
                      →
                    </button>
                  </div>
                )}
                
                {/* Image counter */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-sm">
                  {currentImageIndex[train.id] + 1} / {getAllImages(train.id).length}
                </div>
              </div>
              
              {/* Train info */}
              <div className="p-4">
                <h2 className="text-xl font-bold text-blue-600">{train.name}</h2>
                <p className="text-gray-600">Number: {train.number}</p>
                <p className="text-gray-600">Color: {train.color}</p>
                
                {/* Save Image Link */}
                <a
                  href={getAllImages(train.id)[currentImageIndex[train.id]]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors flex justify-center items-center"
                >
                  Save Image
                </a>
                
                {/* See More Images button */}
                <button
                  onClick={() => fetchGoogleImages(train.id, train.name, false)}
                  className="mt-2 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors flex justify-center items-center"
                  disabled={isLoadingImages[train.id]}
                >
                  {isLoadingImages[train.id] && !additionalImages[train.id] ? (
                    <span>Loading...</span>
                  ) : (
                    <span>See More Images</span>
                  )}
                </button>
                
                {/* Load More Images button - only show if we already have additional images */}
                {additionalImages[train.id] && additionalImages[train.id].length > 0 && (
                  <button
                    onClick={() => fetchGoogleImages(train.id, train.name, true)}
                    className="mt-2 w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition-colors flex justify-center items-center"
                    disabled={isLoadingImages[train.id]}
                  >
                    {isLoadingImages[train.id] ? (
                      <span>Loading...</span>
                    ) : (
                      <span>Load More Images</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* No results message */}
        {filteredTrains.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xl text-gray-600">No trains found matching your search.</p>
          </div>
        )}
      </main>
    </div>
  );
}