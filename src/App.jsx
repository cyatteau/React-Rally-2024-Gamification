import React, { Suspense, lazy, useState, useEffect, useCallback } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  createRoutesFromElements,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { AppProvider, useAppContext } from "./AppContext";
import LocationSearch from "./components/LocationSearch";
import { geocode, reverseGeocode } from "@esri/arcgis-rest-geocoding";
import { ApiKeyManager } from "@esri/arcgis-rest-request";
import useDemographicData from "./hooks/useDemographicData";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import Root from "./components/Root";
import QuestStatus from "./components/QuestStatus";
import CompletionAnimation from "./components/CompletionAnimation";
import { loadLandmarks } from "./utils";

const MapViewComponent = lazy(() => import("./components/MapViewComponent"));
const SimpleMapComponent = lazy(() =>
  import("./components/SimpleMapComponent")
);
const DemographicData = lazy(() => import("./components/DemographicData"));
const Login = lazy(() => import("./components/Login"));
const Profile = lazy(() => import("./components/Profile"));
const apiKey = "yourkey"

function AppContent() {
  const { state, dispatch } = useAppContext();
  const { demographicData, loading, error, fetchData } = useDemographicData();
  const { user, earnBadge, saveVisitedLocation, logout } = useAuth();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [questEnabled, setQuestEnabled] = useState(false);
  const [questStarted, setQuestStarted] = useState(false);
  const [foundLandmarks, setFoundLandmarks] = useState([]);
  const [currentLandmarkIndex, setCurrentLandmarkIndex] = useState(0);
  const [nearbyLandmarks, setNearbyLandmarks] = useState([]); // New state for nearby landmarks
  const [showAnimation, setShowAnimation] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [landmarks, setLandmarks] = useState([]);
  const [showCloseQuestModal, setShowCloseQuestModal] = useState(false);
  const [selectedBasemap, setSelectedBasemap] = useState(
    localStorage.getItem("selectedBasemap") ||
      "f5023edabfee4dd68f2e3f87e2a6c14d"
  );
  useEffect(() => {
    const loadedLandmarks = loadLandmarks();
    setLandmarks(loadedLandmarks);
  }, []);

  useEffect(() => {
    const savedBasemap = localStorage.getItem("selectedBasemap");
    if (savedBasemap) {
      setSelectedBasemap(savedBasemap);
      dispatch({ type: "SET_SELECTED_BASEMAP", payload: savedBasemap });
    }
  }, [dispatch]);

  const handleBasemapChange = (newBasemapId) => {
    setSelectedBasemap(newBasemapId);
    localStorage.setItem("selectedBasemap", newBasemapId);
    dispatch({ type: "SET_SELECTED_BASEMAP", payload: newBasemapId });
  };

  useEffect(() => {
    if (location.pathname === "/") {
      dispatch({ type: "RESET" });
      setCurrentLocation(null);
      setTracking(false);
      setQuestEnabled(false);
      setNearbyLandmarks([]); // Reset nearby landmarks when navigating away
    }
  }, [location.pathname, dispatch]);

  useEffect(() => {
    if (questStarted) {
      const found = JSON.parse(localStorage.getItem("foundLandmarks")) || [];
      setFoundLandmarks(found);
    }
  }, [questStarted]);

  const apiKey = "yourkey"
  ApiKeyManager.fromKey(apiKey);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
  };

  const handleSelectLocation = (suggestion) => {
    const { magicKey } = suggestion;

    geocode({ magicKey, authentication: ApiKeyManager.fromKey(apiKey) })
      .then((result) => {
        if (result.candidates && result.candidates.length > 0) {
          const { location } = result.candidates[0];
          dispatch({
            type: "SET_LOCATION",
            payload: { latitude: location.y, longitude: location.x },
          });
          dispatch({
            type: "SET_LOCATION_INPUT",
            payload: result.candidates[0].attributes.LongLabel,
          });
          dispatch({ type: "SET_SUBMITTED", payload: true });
          fetchData(location.y, location.x);
          setTracking(false); // Not tracking, just searching
        } else {
          console.log("No location found for the given magicKey.");
        }
      })
      .catch((err) => console.error("Geocoding failed:", err));
  };

  const handleReset = () => {
    dispatch({ type: "RESET" });
    setCurrentLocation(null);
    setTracking(false);
    setQuestEnabled(false); // Reset quest enabled state
    setQuestStarted(false);
    setFoundLandmarks([]);
    setNearbyLandmarks([]); // Reset nearby landmarks
    localStorage.removeItem("questStarted");
    localStorage.removeItem("foundLandmarks");
    setCurrentLandmarkIndex(0);
    setShowAnimation(false);
    setShowCongrats(false);
    navigate("/");
  };

  const handleHome = () => {
    dispatch({ type: "RESET" });
    setCurrentLocation(null);
    setTracking(false);
    setQuestEnabled(false); // Reset quest enabled state
    setQuestStarted(false);
    setFoundLandmarks([]);
    setNearbyLandmarks([]); // Reset nearby landmarks
    localStorage.removeItem("questStarted");
    localStorage.removeItem("foundLandmarks");
    setCurrentLandmarkIndex(0);
    setShowAnimation(false);
    setShowCongrats(false);
    navigate("/");
  };

  const handleBadgeClick = (badge) => {
    dispatch({ type: "SET_SELECTED_BADGE", payload: badge });
  };

  const handleTrackLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const dateVisited = new Date().toISOString(); // Capture the current date and time

        setCurrentLocation({ latitude, longitude });
        dispatch({
          type: "SET_LOCATION",
          payload: { latitude, longitude },
        });
        dispatch({ type: "SET_SUBMITTED", payload: true });
        setTracking(true); // Set tracking to true when tracking the location

        try {
          const data = await fetchData(latitude, longitude);
          if (data) {
            data.badges.forEach((badge) => {
              earnBadge(badge);
            });
          }

          // Reverse geocode to get address
          const response = await reverseGeocode([longitude, latitude], {
            authentication: ApiKeyManager.fromKey(apiKey),
          });
          const address = response.address.LongLabel;
          saveVisitedLocation({
            latitude,
            longitude,
            address,
            dateVisited,
          });

          // Filter landmarks to only include those within 1 mile
          const filteredLandmarks = landmarks.filter((landmark) => {
            const distance = calculateDistance(
              latitude,
              longitude,
              landmark.coordinates.latitude,
              landmark.coordinates.longitude
            );
            return distance <= 1.60934; // 1 mile in kilometers
          });

          setNearbyLandmarks(filteredLandmarks); // Update the nearby landmarks state

          const questEnabled = filteredLandmarks.length > 0;
          setQuestEnabled(questEnabled);
        } catch (error) {
          console.error("Failed to fetch demographic data or address:", error);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );
  }, [fetchData, earnBadge, saveVisitedLocation, landmarks, dispatch]);

  const handleTrackNewLocation = useCallback(async () => {
    const landmark = nearbyLandmarks[currentLandmarkIndex];
    if (!landmark) return;

    const { coordinates } = landmark;
    setCurrentLocation(coordinates);
    dispatch({
      type: "SET_LOCATION",
      payload: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
    });

    // Update demographic data, badges, and visited locations
    try {
      const data = await fetchData(coordinates.latitude, coordinates.longitude);
      if (data) {
        data.badges.forEach((badge) => {
          earnBadge(badge);
        });
      }

      // Reverse geocode to get address
      const response = await reverseGeocode(
        [coordinates.longitude, coordinates.latitude],
        {
          authentication: ApiKeyManager.fromKey(apiKey),
        }
      );
      const address = response.address.LongLabel;
      const dateVisited = new Date().toISOString();
      saveVisitedLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address,
        dateVisited,
      });

      // Update the found landmarks list
      setFoundLandmarks((prev) => {
        const updated = [...prev];
        if (!updated.includes(landmark)) {
          updated.push(landmark);
        }
        return updated;
      });

      localStorage.setItem(
        "foundLandmarks",
        JSON.stringify([...foundLandmarks, landmark])
      );

      if (foundLandmarks.length + 1 === nearbyLandmarks.length) {
        setShowCongrats(true); // Show congrats popup
        setTimeout(() => {
          handleEndQuest();
        }, 3000); // Show congrats message for 5 seconds before ending the quest
      }
    } catch (error) {
      console.error("Failed to fetch demographic data or address:", error);
    }

    setCurrentLandmarkIndex((prevIndex) =>
      prevIndex + 1 < nearbyLandmarks.length ? prevIndex + 1 : prevIndex
    );
    setTracking(true);
  }, [
    dispatch,
    nearbyLandmarks,
    currentLandmarkIndex,
    fetchData,
    earnBadge,
    saveVisitedLocation,
    foundLandmarks,
  ]);

  const handleStartQuest = () => {
    if (questEnabled) {
      setQuestStarted(true);
      localStorage.setItem("questStarted", true);
      console.log("Quest started!");
    } else {
      console.log(
        "You need to be near at least one landmark to start the quest."
      );
    }
  };

  const handleEndQuestButtonClick = () => {
    setShowCloseQuestModal(true); // Trigger the modal for both buttons
  };

  const handleEndQuest = () => {
    setQuestStarted(false);
    setFoundLandmarks([]);
    setNearbyLandmarks([]);
    localStorage.removeItem("questStarted");
    localStorage.removeItem("foundLandmarks");
    setCurrentLandmarkIndex(0);
    setShowAnimation(false);
    setShowCongrats(false);
    // Reset the questEnabled to false here, so the Start Quest button is hidden
    setQuestEnabled(false);
    navigate("/"); // Reset to the home page or another suitable page
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCloseQuest = () => {
    setShowCloseQuestModal(true);
  };

  const confirmCloseQuest = () => {
    handleEndQuest();
    setShowCloseQuestModal(false); // Close the modal
    navigate("/"); // Navigate to home or another page
  };

  const cancelCloseQuest = () => {
    setShowCloseQuestModal(false);
  };

  return (
    <div className={`App ${questStarted ? "quest-in-progress" : ""}`}>
      {!questStarted && (
        <nav className="navbar">
          <div className="nav-links">
            <button onClick={handleHome}>Home</button>
            {user ? (
              <>
                <button onClick={() => navigate("/profile")}>Profile</button>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </>
            ) : (
              <button onClick={() => navigate("/login")}>Login</button>
            )}
          </div>
        </nav>
      )}
      {questStarted && (
        <>
          <div className="quest-message quest-progress">
            <p className="quest-progress">Quest in Progress...</p>
          </div>
        </>
      )}
      <div
        className={`layout-container ${state.submitted ? "split-layout" : ""} ${
          questStarted ? "dimmed-content" : ""
        }`}
      >
        <div className="stats-badges-container">
          <div className="form-container">
            {user && !state.submitted && (
              <button onClick={handleTrackLocation} className="track-button">
                📍 Track Current Location
              </button>
            )}
            {!state.submitted ? (
              <LocationSearch
                onSelectLocation={handleSelectLocation}
                apiKey={apiKey}
                locationInput={state.locationInput}
                setLocationInput={(input) =>
                  dispatch({ type: "SET_LOCATION_INPUT", payload: input })
                }
              />
            ) : (
              <>
                {!questStarted && (
                  <button onClick={handleReset} className="reset-button">
                    {tracking
                      ? "📍 Track a New Location"
                      : "🔎 Search a New Location"}
                  </button>
                )}
                <div>
                  {loading && <p>Loading...</p>}
                  {error && <p>{error.message}</p>}
                  {demographicData && (
                    <Suspense fallback={<div>Loading...</div>}>
                      <DemographicData
                        funFact={demographicData.funFact}
                        badges={demographicData.badges}
                        handleBadgeClick={handleBadgeClick}
                        selectedBadge={state.selectedBadge}
                        setSelectedBadge={(badge) =>
                          dispatch({
                            type: "SET_SELECTED_BADGE",
                            payload: badge,
                          })
                        }
                        isTracking={tracking}
                        user={user}
                      />
                    </Suspense>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="map-container">
          <Suspense fallback={<div>Loading...</div>}>
            {state.location ? (
              <MapViewComponent
                location={state.location}
                landmarks={nearbyLandmarks} // Pass only nearby landmarks
                selectedBasemap={selectedBasemap} // Pass the selected basemap
              />
            ) : (
              <SimpleMapComponent selectedBasemap={selectedBasemap} />
            )}
          </Suspense>
        </div>
      </div>
      <QuestStatus
        questStarted={questStarted}
        foundLandmarks={foundLandmarks.length}
        totalLandmarks={nearbyLandmarks.length} // Only count nearby landmarks
      />
      {questStarted && (
        <>
          <button onClick={handleTrackNewLocation} className="track-button">
            Track New Location
          </button>
          <button
            onClick={handleEndQuestButtonClick}
            className="end-quest-button"
          >
            End Quest
          </button>
        </>
      )}
      {showAnimation && <CompletionAnimation />}
      {showCongrats && (
        <div className="popup-container">
          <div className="congrats-popup">
            <p>
              Congratulations! You visited all places and finished the quest!
            </p>
          </div>
        </div>
      )}
      {questEnabled && !questStarted && (
        <div className="quest-start-container">
          <button onClick={handleStartQuest} className="start-quest-button">
            Start Quest
          </button>
        </div>
      )}

      {showCloseQuestModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Quit Quest?</h2>
            <p>
              Are you sure you want to quit? You will lose all progress toward
              finishing the quest. However, visited locations will be saved.
            </p>
            <div className="modal-buttons">
              <button onClick={confirmCloseQuest} className="confirm-button">
                Yes, Quit
              </button>
              <button onClick={cancelCloseQuest} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={<Root />}
      errorElement={<div>Something went wrong!"</div>}
    >
      <Route index element={<AppContent />} />
      <Route
        path="login"
        element={
          <Suspense fallback={<div>Loading...</div>}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="profile"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div>Loading...</div>}>
              <Profile />
            </Suspense>
          </ProtectedRoute>
        }
      />
    </Route>
  )
);

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppProvider>
  );
}

export default App;
