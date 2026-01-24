"""
MIRT 3PL Scoring Engine for Manshaan Platform.

Implements Multidimensional Item Response Theory with:
- 3-Parameter Logistic model (discrimination, difficulty, guessing)
- Expected A Posteriori (EAP) estimation for θ
- Multi-domain items (items loading on multiple cognitive domains)
- Maximum Fisher Information item selection
- Simulation mode for demonstrating convergence
"""

import json
import numpy as np
from scipy import integrate
from scipy.stats import norm
from pathlib import Path
from typing import Optional
import logging

from ..models.irt import (
    Domain, IRTItem, DomainTheta, ResponseRecord, 
    SessionState, SimulationResult, ItemType
)
from ..config import get_settings

logger = logging.getLogger(__name__)


class IRTEngine:
    """
    MIRT 3PL Scoring Engine.
    
    Handles:
    - Loading item bank
    - Computing response probabilities
    - EAP estimation of θ per domain
    - Optimal item selection
    - Simulation mode for demos
    """
    
    def __init__(self, item_bank_path: Optional[Path] = None):
        """Initialize engine with item bank."""
        self.settings = get_settings()
        self.items: dict[str, IRTItem] = {}
        self.quadrature_points = self._generate_quadrature_points()
        
        # Load item bank
        if item_bank_path is None:
            item_bank_path = Path(__file__).parent.parent / "data" / "item_bank.json"
        self._load_item_bank(item_bank_path)
    
    def _generate_quadrature_points(self) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate Gauss-Hermite quadrature points for EAP integration.
        Returns (points, weights) for numerical integration.
        """
        n_points = self.settings.irt_quadrature_points
        # Generate points from -4 to 4 (covers >99.99% of N(0,1))
        points = np.linspace(-4, 4, n_points)
        # Weights are N(0,1) density values
        weights = norm.pdf(points)
        weights /= weights.sum()  # Normalize
        return points, weights
    
    def _load_item_bank(self, path: Path) -> None:
        """Load and parse item bank JSON."""
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            
            for item_data in data.get("items", []):
                # Convert domain_loadings keys from strings to Domain enum
                domain_loadings = {
                    Domain(k): v 
                    for k, v in item_data.get("domain_loadings", {}).items()
                }
                
                item = IRTItem(
                    id=item_data["id"],
                    prompt=item_data["prompt"],
                    item_type=ItemType(item_data.get("item_type", "mcq")),
                    domain_loadings=domain_loadings,
                    difficulty=item_data.get("difficulty", item_data.get("b", 0.0)),
                    guessing=item_data.get("guessing", item_data.get("c", 0.2)),
                    options=item_data.get("options"),
                    correct_answer=item_data.get("correct_answer"),
                    instructions=item_data.get("instructions"),
                    time_limit_seconds=item_data.get("time_limit_seconds")
                )
                self.items[item.id] = item
            
            logger.info(f"Loaded {len(self.items)} items from item bank")
        except FileNotFoundError:
            logger.warning(f"Item bank not found at {path}, starting empty")
        except Exception as e:
            logger.error(f"Error loading item bank: {e}")
    
    def probability_correct(
        self, 
        item: IRTItem, 
        theta: dict[Domain, float]
    ) -> float:
        """
        Compute probability of correct response using MIRT 3PL model.
        
        P(θ) = c + (1 - c) / (1 + exp(-Σ(aₖ(θₖ - b))))
        
        For compensatory MIRT, we sum the weighted deviations from difficulty
        across all domains the item loads on.
        
        Args:
            item: The IRT item with domain loadings
            theta: Current θ estimates per domain
            
        Returns:
            Probability of correct response (0-1)
        """
        c = item.guessing
        b = item.difficulty
        
        # Compute linear combination: Σ aₖ(θₖ - b)
        linear_combo = sum(
            a * (theta.get(domain, 0.0) - b)
            for domain, a in item.domain_loadings.items()
        )
        
        # Apply 3PL formula
        exp_term = np.exp(-linear_combo)
        p = c + (1 - c) / (1 + exp_term)
        
        return float(np.clip(p, 0.001, 0.999))  # Avoid log(0)
    
    def fisher_information(
        self, 
        item: IRTItem, 
        theta: dict[Domain, float],
        domain: Domain
    ) -> float:
        """
        Compute Fisher Information for an item at given θ for a specific domain.
        
        I(θ) = a²ₖ * [(P - c)² / (1 - c)² * P] * [(1 - P) / P]
        
        Higher information = item discriminates better at this ability level.
        
        Args:
            item: The IRT item
            theta: Current θ estimates
            domain: Which domain to compute information for
            
        Returns:
            Fisher information value
        """
        if domain not in item.domain_loadings:
            return 0.0
        
        a = item.domain_loadings[domain]
        c = item.guessing
        p = self.probability_correct(item, theta)
        
        # Avoid division by zero
        if p <= c or p >= 1:
            return 0.0
        
        numerator = a**2 * ((p - c)**2) * (1 - p)
        denominator = ((1 - c)**2) * p
        
        return float(numerator / denominator)
    
    def total_information(
        self, 
        item: IRTItem, 
        theta: dict[Domain, float]
    ) -> float:
        """
        Compute total Fisher Information across all domains.
        Used for item selection.
        """
        return sum(
            self.fisher_information(item, theta, domain)
            for domain in Domain
        )
    
    def update_theta_eap(
        self, 
        responses: list[ResponseRecord],
        administered_items: list[str]
    ) -> dict[Domain, DomainTheta]:
        """
        Update θ estimates using Expected A Posteriori (EAP).
        
        θ_EAP = ∫ θ * L(θ|responses) * π(θ) dθ / ∫ L(θ|responses) * π(θ) dθ
        
        Uses Gaussian quadrature for numerical integration.
        Computes EAP independently for each domain (simplified MIRT).
        
        Args:
            responses: List of response records
            administered_items: Item IDs that were administered
            
        Returns:
            Updated θ estimates with standard errors
        """
        points, weights = self.quadrature_points
        result = {}
        
        for domain in Domain:
            # Get items that load on this domain
            relevant_items = [
                (self.items[r.item_id], r)
                for r in responses
                if r.item_id in self.items 
                and domain in self.items[r.item_id].domain_loadings
                and r.is_correct is not None
            ]
            
            if not relevant_items:
                # No data for this domain yet
                result[domain] = DomainTheta(
                    domain=domain,
                    theta=0.0,
                    standard_error=1.0,
                    percentile=50.0
                )
                continue
            
            # Compute likelihood at each quadrature point
            likelihoods = np.ones(len(points))
            
            for item, response in relevant_items:
                for i, theta_point in enumerate(points):
                    # Create theta dict with this point for the domain
                    theta_dict = {d: 0.0 for d in Domain}
                    theta_dict[domain] = theta_point
                    
                    p = self.probability_correct(item, theta_dict)
                    
                    if response.is_correct:
                        likelihoods[i] *= p
                    else:
                        likelihoods[i] *= (1 - p)
            
            # EAP: weighted average
            posterior = likelihoods * weights
            posterior_sum = posterior.sum()
            
            if posterior_sum > 0:
                theta_eap = (points * posterior).sum() / posterior_sum
                # Posterior variance for SE
                variance = ((points - theta_eap)**2 * posterior).sum() / posterior_sum
                se = np.sqrt(variance)
            else:
                theta_eap = 0.0
                se = 1.0
            
            # Convert to percentile
            percentile = norm.cdf(theta_eap) * 100
            
            result[domain] = DomainTheta(
                domain=domain,
                theta=float(theta_eap),
                standard_error=float(se),
                percentile=float(percentile)
            )
        
        return result
    
    def select_next_item(
        self,
        session_state: SessionState,
        max_items: int = 50
    ) -> Optional[IRTItem]:
        """
        Select optimal next item using Maximum Fisher Information.
        
        Chooses the unadministered item with highest total information
        at the current θ estimates.
        
        Args:
            session_state: Current session state
            max_items: Maximum items per session
            
        Returns:
            Next item to administer, or None if complete
        """
        if session_state.items_administered >= max_items:
            return None
        
        administered_ids = {r.item_id for r in session_state.responses}
        current_theta = {
            domain: estimate.theta 
            for domain, estimate in session_state.theta_estimates.items()
        }
        
        best_item = None
        best_info = -1
        
        for item_id, item in self.items.items():
            if item_id in administered_ids:
                continue
            
            info = self.total_information(item, current_theta)
            
            if info > best_info:
                best_info = info
                best_item = item
        
        return best_item
    
    def process_response(
        self,
        session_state: SessionState,
        item_id: str,
        response: int | str,
        response_time_ms: int
    ) -> SessionState:
        """
        Process a response and update session state.
        
        Args:
            session_state: Current state
            item_id: ID of item responded to
            response: The response (MCQ index or transcript)
            response_time_ms: Response time in milliseconds
            
        Returns:
            Updated session state
        """
        item = self.items.get(item_id)
        if not item:
            raise ValueError(f"Unknown item: {item_id}")
        
        # Determine correctness for MCQ
        is_correct = None
        if item.item_type == ItemType.MCQ and item.correct_answer is not None:
            is_correct = (response == item.correct_answer)
        
        # Create response record
        record = ResponseRecord(
            item_id=item_id,
            response=response,
            response_time_ms=response_time_ms,
            is_correct=is_correct
        )
        
        # Update state
        session_state.responses.append(record)
        session_state.items_administered += 1
        
        # Update theta estimates
        administered_ids = [r.item_id for r in session_state.responses]
        session_state.theta_estimates = self.update_theta_eap(
            session_state.responses,
            administered_ids
        )
        
        return session_state
    
    def run_simulation(
        self,
        true_theta: dict[Domain, float],
        num_items: int = 20
    ) -> SimulationResult:
        """
        Run simulation mode to demonstrate θ convergence.
        
        Simulates responses based on true θ values and shows
        how EAP estimates converge to true values.
        
        Args:
            true_theta: True ability values per domain
            num_items: Number of items to simulate
            
        Returns:
            SimulationResult with convergence trajectory
        """
        # Initialize session
        session = SessionState(
            session_id="simulation",
            patient_id="simulation",
            theta_estimates={
                d: DomainTheta(domain=d, theta=0.0, standard_error=1.0)
                for d in Domain
            }
        )
        
        theta_trajectory = []
        se_trajectory = []
        items_used = []
        convergence_threshold = self.settings.irt_convergence_threshold
        convergence_item = num_items
        
        for i in range(num_items):
            # Select next item
            next_item = self.select_next_item(session, max_items=100)
            if not next_item:
                break
            
            items_used.append(next_item.id)
            
            # Simulate response based on true θ
            p = self.probability_correct(next_item, true_theta)
            is_correct = np.random.random() < p
            
            # Process simulated response
            session = self.process_response(
                session,
                next_item.id,
                1 if is_correct else 0,
                response_time_ms=1000
            )
            
            # Also set is_correct for MCQ simulation
            session.responses[-1].is_correct = is_correct
            session.theta_estimates = self.update_theta_eap(
                session.responses,
                items_used
            )
            
            # Record trajectory
            theta_trajectory.append({
                d: session.theta_estimates[d].theta for d in Domain
            })
            se_trajectory.append({
                d: session.theta_estimates[d].standard_error for d in Domain
            })
            
            # Check convergence
            if i > 5:  # Need minimum items
                max_se = max(se_trajectory[-1].values())
                if max_se < convergence_threshold and convergence_item == num_items:
                    convergence_item = i + 1
        
        return SimulationResult(
            true_theta=true_theta,
            theta_trajectory=theta_trajectory,
            se_trajectory=se_trajectory,
            items_used=items_used,
            final_theta=session.theta_estimates,
            convergence_achieved=(convergence_item < num_items),
            num_items_to_convergence=convergence_item
        )


# Singleton instance
_engine: Optional[IRTEngine] = None


def get_irt_engine() -> IRTEngine:
    """Get or create IRT engine singleton."""
    global _engine
    if _engine is None:
        _engine = IRTEngine()
    return _engine
